# 项目上下文

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4

## 目录结构

```
├── public/                 # 静态资源
├── scripts/                # 构建与启动脚本
├── src/
│   ├── app/                # 页面路由与布局
│   │   ├── page.tsx        # 首页看板
│   │   ├── layout.tsx      # 根布局（含侧边栏）
│   │   ├── globals.css     # 全局样式
│   │   ├── import/         # 数据导入页（多报表上传）
│   │   ├── profit/         # SKU利润表页
│   │   ├── history/        # 历史对比页
│   │   └── fees/           # 费用分析页
│   ├── components/
│   │   ├── layout/         # 布局组件（侧边栏）
│   │   └── ui/             # Shadcn UI 组件库
│   ├── hooks/              # 自定义 Hooks
│   └── lib/                # 工具库
│       ├── utils.ts        # 通用工具函数
│       ├── types.ts        # 类型定义（含多报表类型）
│       ├── idb.ts          # IndexedDB 操作
│       ├── excel-parser.ts # 交易明细Excel解析
│       ├── report-parser.ts # 多报表解析器（结算/仓储/广告/退货）
│       └── profit-calculator.ts # 利润计算（支持多报表合并）
├── DESIGN.md               # 设计规范
├── next.config.ts          # Next.js 配置
├── package.json            # 项目依赖管理
└── tsconfig.json           # TypeScript 配置
```

### 项目说明

这是一个亚马逊利润报表自动生成工具，核心功能：
- **数据上传**：支持5种报表类型（交易明细/结算报告/仓储费报告/广告报告/退货报告）
- **自动识别**：根据列名特征智能判断报表类型
- **自动归类**：按交易类型（Order/Refund/FBA Fee等）分类
- **多报表合并**：多种报表数据自动合并计算，数据来源标注
- **SKU利润表**：30+列明细，按SKU维度汇总
- **多Sheet导出**：SKU利润表 + 共享费用 + 全局收支核对
- **历史记录**：IndexedDB本地存储，按月保存
- **可视化**：趋势图表 (recharts)

### 核心文件说明

| 文件 | 说明 |
|------|------|
| `src/lib/types.ts` | 全局类型定义，含 ReportType、ReportMeta、SettlementReport 等 |
| `src/lib/excel-parser.ts` | 交易明细Excel解析，含列名归一化、交易类型识别 |
| `src/lib/report-parser.ts` | 多报表解析器：结算报告/仓储费报告/广告报告/退货报告 + 自动识别 |
| `src/lib/profit-calculator.ts` | 利润计算，支持多报表数据合并 |
| `src/lib/idb.ts` | IndexedDB 本地存储操作 |
| `src/app/import/page.tsx` | 数据导入页，含报表类型选择器、已上传报表列表、解析预览 |

### 多报表支持说明

**报表类型**：`transaction`(交易明细) / `settlement`(结算报告) / `storage`(仓储费) / `advertising`(广告报告) / `return`(退货报告)

**自动识别**：根据文件列名特征匹配，支持 `auto` 模式自动判断

**数据合并**：
- 交易明细中的仓储费 + 仓储费报告中的仓储费 = 总仓储费
- 交易明细中的广告费 + 广告报告中的广告费 = 总广告费
- 退货报告中的退款数据与交易明细交叉验证
- 结算报告中的汇总数据与利润表做交叉验证

### 核心依赖
- `xlsx` - Excel解析与生成
- `recharts` - 图表可视化
- `lucide-react` - 图标库
- `shadcn/ui` - UI组件库

- 项目文件（如 app 目录、pages 目录、components 等）默认初始化到 `src/` 目录下。

## 包管理规范

**仅允许使用 pnpm** 作为包管理器，**严禁使用 npm 或 yarn**。
**常用命令**：
- 安装依赖：`pnpm add <package>`
- 安装开发依赖：`pnpm add -D <package>`
- 安装所有依赖：`pnpm install`
- 移除依赖：`pnpm remove <package>`

## 开发规范

### 编码规范

- 默认按 TypeScript `strict` 心智写代码；优先复用当前作用域已声明的变量、函数、类型和导入，禁止引用未声明标识符或拼错变量名。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。

### next.config 配置规范

- 配置的路径不要写死绝对路径，必须使用 path.resolve(__dirname, ...)、import.meta.dirname 或 process.cwd() 动态拼接。

### Hydration 问题防范

1. 严禁在 JSX 渲染逻辑中直接使用 typeof window、Date.now()、Math.random() 等动态数据。**必须使用 'use client' 并配合 useEffect + useState 确保动态内容仅在客户端挂载后渲染**；同时严禁非法 HTML 嵌套（如 <p> 嵌套 <div>）。
2. **禁止使用 head 标签**，优先使用 metadata，详见文档：https://nextjs.org/docs/app/api-reference/functions/generate-metadata
   1. 三方 CSS、字体等资源可在 `globals.css` 中顶部通过 `@import` 引入或使用 next/font
   2. preload, preconnect, dns-prefetch 通过 ReactDOM 的 preload、preconnect、dns-prefetch 方法引入
   3. json-ld 可阅读 https://nextjs.org/docs/app/guides/json-ld

## UI 设计与组件规范 (UI & Styling Standards)

- 模板默认预装核心组件库 `shadcn/ui`，位于`src/components/ui/`目录下
- Next.js 项目**必须默认**采用 shadcn/ui 组件、风格和规范，**除非用户指定用其他的组件和规范。**
