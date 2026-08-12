import * as XLSX from 'xlsx';
import JSZip from 'jszip';

/**
 * 智能文件读取器
 * 处理 .xlsx (包括 xlsx 库无法解析的 ZIP64 格式)、.xls、.csv、.zip、.txt 文件
 *
 * 核心策略:
 * 1. 先尝试 xlsx 库直接解析
 * 2. 如果失败("Unsupported ZIP file")，用 jszip 重新打包再解析
 * 3. 如果仍失败，手动解析 XML
 */

export async function readFileSmart(file: File): Promise<XLSX.WorkBook> {
  const arrayBuffer = await file.arrayBuffer();
  const uint8 = new Uint8Array(arrayBuffer);

  // 检查文件签名
  const isZip = uint8.length >= 2 && uint8[0] === 0x50 && uint8[1] === 0x4B; // PK
  const isExcelOld = uint8.length >= 2 && uint8[0] === 0xD0 && uint8[1] === 0xCF; // OLE
  const isText = !isZip && !isExcelOld;

  // 非ZIP文件: 直接用 xlsx 库 (支持 .xls 和 CSV)
  if (!isZip) {
    if (isText) {
      const text = new TextDecoder('utf-8').decode(uint8);
      return XLSX.read(text, { type: 'string' });
    }
    return XLSX.read(uint8, { type: 'array' });
  }

  // ZIP 文件: 先尝试 xlsx 库
  try {
    return XLSX.read(uint8, { type: 'array' });
  } catch (primaryErr) {
    const errMsg = primaryErr instanceof Error ? primaryErr.message : '';
    // xlsx 库解析失败，可能是 ZIP64 或特殊压缩
    if (errMsg.includes('Unsupported ZIP') || errMsg.includes('zip') || errMsg.includes('ZIP')) {
      // 尝试用 jszip 重新打包
      try {
        const rezipped = await rezipWithJszip(arrayBuffer);
        return XLSX.read(rezipped, { type: 'array' });
      } catch (rezErr) {
        // 重新打包也失败，手动解析 XML
        try {
          return await parseXlsxManually(arrayBuffer);
        } catch (manualErr) {
          // 如果不是 xlsx 格式，尝试解析 ZIP 内的 CSV
          return await parseZipContents(arrayBuffer);
        }
      }
    }
    throw primaryErr;
  }
}

/**
 * 用 jszip 重新打包 ZIP 文件，生成标准 ZIP 格式
 */
async function rezipWithJszip(arrayBuffer: ArrayBuffer): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const newZip = new JSZip();

  // 遍历所有文件，提取并重新添加
  const files = Object.keys(zip.files);
  for (const path of files) {
    const entry = zip.files[path];
    if (entry.dir) {
      newZip.folder(path);
    } else {
      const content = await entry.async('uint8array');
      newZip.file(path, content);
    }
  }

  // 生成标准 ZIP（不使用 ZIP64）
  const result = await newZip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  return result;
}

/**
 * 手动解析 xlsx 的 XML 内容
 */
async function parseXlsxManually(arrayBuffer: ArrayBuffer): Promise<XLSX.WorkBook> {
  const zip = await JSZip.loadAsync(arrayBuffer);

  // 检查是否是 xlsx 格式
  const hasXlFolder = Object.keys(zip.files).some(p => p.startsWith('xl/'));
  if (!hasXlFolder) {
    throw new Error('Not an xlsx file');
  }

  // 读取共享字符串
  let sharedStrings: string[] = [];
  const ssFile = zip.file('xl/sharedStrings.xml');
  if (ssFile) {
    const xml = await ssFile.async('string');
    sharedStrings = parseSharedStrings(xml);
  }

  // 读取 workbook.xml 获取 sheet 名称和对应关系
  const wbXmlFile = zip.file('xl/workbook.xml');
  let sheetNames: string[] = [];
  if (wbXmlFile) {
    const xml = await wbXmlFile.async('string');
    sheetNames = parseWorkbookSheetNames(xml);
  }

  // 读取 workbook.xml.rels 获取 sheet 文件映射
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  let sheetFileMap: Map<string, string> = new Map();
  if (relsFile) {
    const xml = await relsFile.async('string');
    sheetFileMap = parseWorkbookRels(xml);
  }

  // 解析每个 worksheet
  const wb = XLSX.utils.book_new();

  const sheetRegex = /^xl\/worksheets\/sheet(\d+)\.xml$/;
  const sheetFiles = Object.keys(zip.files)
    .filter(p => sheetRegex.test(p))
    .sort((a, b) => {
      const numA = parseInt(sheetRegex.exec(a)![1]);
      const numB = parseInt(sheetRegex.exec(b)![1]);
      return numA - numB;
    });

  for (let i = 0; i < sheetFiles.length; i++) {
    const sheetFile = zip.file(sheetFiles[i]);
    if (!sheetFile) continue;

    const xml = await sheetFile.async('string');
    const ws = parseWorksheetXml(xml, sharedStrings);

    let sheetName = sheetNames[i] || `Sheet${i + 1}`;
    // 确保 sheet 名称合法且不重复
    sheetName = sanitizeSheetName(sheetName, wb.SheetNames);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  if (wb.SheetNames.length === 0) {
    throw new Error('xlsx 文件中没有找到任何工作表');
  }

  return wb;
}

/**
 * 解析 ZIP 内容（CSV/TXT 文件）
 */
async function parseZipContents(arrayBuffer: ArrayBuffer): Promise<XLSX.WorkBook> {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const wb = XLSX.utils.book_new();

  const dataFiles = Object.keys(zip.files).filter(p =>
    !zip.files[p].dir &&
    (p.endsWith('.csv') || p.endsWith('.txt') || p.endsWith('.tsv') || p.endsWith('.xlsx') || p.endsWith('.xls'))
  );

  if (dataFiles.length === 0) {
    throw new Error('ZIP 文件中未找到可识别的数据文件（CSV/Excel/TXT）');
  }

  for (const filePath of dataFiles) {
    const file = zip.files[filePath];
    const fileName = filePath.split('/').pop() || filePath;
    const sheetName = sanitizeSheetName(fileName.replace(/\.(csv|txt|tsv|xlsx|xls)$/i, ''), wb.SheetNames);

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
      const content = await file.async('uint8array');
      try {
        const innerWb = XLSX.read(content, { type: 'array' });
        for (const innerSheetName of innerWb.SheetNames) {
          const ws = innerWb.Sheets[innerSheetName];
          XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(innerSheetName, wb.SheetNames));
        }
      } catch {
        // 内部 xlsx 也无法解析，跳过
      }
    } else {
      // CSV/TXT 文件
      const content = await file.async('string');
      const sheet = XLSX.read(content, { type: 'string' });
      if (sheet.SheetNames.length > 0) {
        XLSX.utils.book_append_sheet(wb, sheet.Sheets[sheet.SheetNames[0]], sheetName);
      }
    }
  }

  if (wb.SheetNames.length === 0) {
    throw new Error('无法解析 ZIP 文件中的任何数据文件');
  }

  return wb;
}

// ====== XML 解析辅助函数 ======

function parseSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = siRegex.exec(xml)) !== null) {
    // 提取 <t> 标签中的文本（可能多个）
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let tMatch;
    let text = '';
    while ((tMatch = tRegex.exec(match[1])) !== null) {
      text += decodeXmlEntities(tMatch[1]);
    }
    strings.push(text);
  }
  return strings;
}

function parseWorkbookSheetNames(xml: string): string[] {
  const names: string[] = [];
  const sheetRegex = /<sheet\b[^>]*?name="([^"]*)"[^>]*?\/?>/g;
  let match;
  while ((match = sheetRegex.exec(xml)) !== null) {
    names.push(decodeXmlEntities(match[1]));
  }
  return names;
}

function parseWorkbookRels(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const relRegex = /<Relationship\b[^>]*?Id="([^"]*)"[^>]*?Target="([^"]*)"[^>]*?\/?>/g;
  let match;
  while ((match = relRegex.exec(xml)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}

function parseWorksheetXml(xml: string, sharedStrings: string[]): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};

  let maxRow = 0;
  let maxCol = 0;

  // 解析行和单元格
  const rowRegex = /<row\b[^>]*>([\s\S]*?)<\/row>/g;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    const rowContent = rowMatch[1];

    // 解析单元格: <c r="A1" t="s"><v>0</v></c> 或 <c r="A1" t="inlineStr"><is><t>text</t></is></c>
    const cellRegex = /<c\b[^>]*?\br="([A-Z]+\d+)"[^>]*?(?:\bt="([^"]*)")?[^>]*?>([\s\S]*?)<\/c>/g;
    let cellMatch;

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      const ref = cellMatch[1];
      const type = cellMatch[2] || '';
      const innerXml = cellMatch[3] || '';

      // 提取值
      let value: string | number | boolean | undefined;
      let cellType: 's' | 'n' | 'b' | 'str' | undefined;

      // 尝试 <v> 标签
      const vMatch = innerXml.match(/<v\b[^>]*>([\s\S]*?)<\/v>/);
      // 尝试 inline string <is><t>text</t></is>
      const isMatch = innerXml.match(/<is\b[^>]*>([\s\S]*?)<\/is>/);
      const tMatch = isMatch ? isMatch[1].match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) : null;

      if (type === 's' && vMatch) {
        // 共享字符串
        const idx = parseInt(vMatch[1]);
        value = sharedStrings[idx] || '';
        cellType = 's';
      } else if (type === 'inlineStr' || type === 'str') {
        // 内联字符串
        if (tMatch) {
          let text = '';
          for (const t of tMatch) {
            const tm = t.match(/<t\b[^>]*>([\s\S]*?)<\/t>/);
            if (tm) text += decodeXmlEntities(tm[1]);
          }
          value = text;
          cellType = 's';
        }
      } else if (type === 'b' && vMatch) {
        value = vMatch[1] === '1' || vMatch[1].toLowerCase() === 'true';
        cellType = 'b';
      } else if (vMatch) {
        value = parseFloat(vMatch[1]);
        cellType = 'n';
        // 检查是否是日期格式
        if (value > 25569 && value < 60000) {
          // 可能是日期序列号
        }
      }

      if (value !== undefined) {
        ws[ref] = { v: value, t: cellType || 'n' };
      }

      // 更新范围
      const colMatch = ref.match(/([A-Z]+)(\d+)/);
      if (colMatch) {
        const col = col2num(colMatch[1]);
        const row = parseInt(colMatch[2]) - 1;
        if (col > maxCol) maxCol = col;
        if (row > maxRow) maxRow = row;
      }
    }
  }

  // 设置范围
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: maxRow, c: maxCol },
  });

  return ws;
}

function col2num(col: string): number {
  let num = 0;
  for (let i = 0; i < col.length; i++) {
    num = num * 26 + (col.charCodeAt(i) - 64);
  }
  return num - 1;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function sanitizeSheetName(name: string, existing: string[]): string {
  // 移除非法字符
  let safe = name.replace(/[\\\/\?\*\[\]:]/g, '_').trim();
  if (!safe) safe = 'Sheet';
  // 限制长度
  if (safe.length > 31) safe = safe.substring(0, 31);
  // 确保不重复
  let finalName = safe;
  let counter = 1;
  while (existing.includes(finalName)) {
    const suffix = `_${counter}`;
    finalName = safe.substring(0, 31 - suffix.length) + suffix;
    counter++;
  }
  return finalName;
}
