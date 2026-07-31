'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileUp,
  Store,
  Calculator,
  BarChart3,
  Settings,
  DollarSign,
  BookOpen,
  Table,
  RefreshCw,
} from 'lucide-react';

const sections = [
  {
    icon: BookOpen,
    title: '系统概述',
    content: `亚马逊利润报表系统是一个纯前端工具，用于自动解析亚马逊后台下载的各类报表，生成SKU级别的利润分析表。
系统支持多店铺管理、多报表合并、汇率换算等功能，所有数据存储在浏览器的本地数据库中，无需外部服务器。`,
  },
  {
    icon: FileUp,
    title: '第一步：数据导入',
    items: [
      {
        sub: '支持的报表类型',
        detail: `系统支持7种亚马逊报表类型：
• 交易明细 - 亚马逊后台下载的 settlement 报告，包含订单、退款、各项费用
• 结算报告 - 亚马逊结算报告，用于交叉验证总利润
• 仓储费报告 - 月度仓储费，按SKU提取
• 广告报告 - SP/SB/SD 广告花费报告
• 退货报告 - 退货数据，与交易明细交叉验证
• 产品成本/FOB - 采购成本/FOB价格，替换交易明细中的成本估算
• 尾程运费 - 海外仓配送费，替换交易明细中的运费估算`,
      },
      {
        sub: '负责人映射（可选）',
        detail: `上传 Excel 包含"品名、SKU、负责人"三列，建立 SKU→负责人映射关系。
利润表的"负责人"列会优先使用映射表中的数据，未匹配则使用店铺默认负责人。`,
      },
      {
        sub: '操作步骤',
        detail: `① 选择店铺 → ② 选择报表类型 → ③ 上传Excel文件
④ 确认解析结果预览 → ⑤ 点击「计算利润」生成报表`,
      },
    ],
  },
  {
    icon: Store,
    title: '第二步：多店铺管理',
    items: [
      {
        sub: '店铺设置',
        detail: `在「店铺管理」页面可以：
• 新增/编辑/删除店铺（最少保留一个）
• 为每个店铺设置货币单位（USD/CAD/EUR/GBP/JPY/CNY）
• 设置店铺默认负责人`,
      },
      {
        sub: '数据筛选',
        detail: `所有页面顶部都有店铺筛选器：
• 选择「全部」查看所有店铺汇总数据
• 选择具体店铺查看该店独立数据`,
      },
    ],
  },
  {
    icon: Calculator,
    title: '第三步：利润表查看',
    items: [
      {
        sub: '41列SKU利润表',
        detail: `系统自动生成完整的41列利润表，包含：
• 收入部分：商品销售收入、运费收入、退款等
• 佣金部分：销售佣金、Coupon费
• FBA费用：配送费、退货处理费、入库异常费等
• 仓储费：月度仓储费、超龄附加费
• 其他费用：清算费、弃置费、订阅费等
• 外部成本：广告费、头程、产品成本、尾程运费
• 汇总：SKU净收入、负责人`,
      },
      {
        sub: '汇率换算',
        detail: `利润表顶部可选择「显示货币」：
• 系统根据各店铺的原始货币和汇率规则自动换算
• 优先使用该月份的月度汇率，没有则使用默认汇率
• 无汇率配置时提示用户先去汇率管理设置`,
      },
      {
        sub: '导出Excel',
        detail: `点击「导出Excel」按钮，系统生成包含3个Sheet的Excel文件：
• Sheet1: SKU利润表（41列完整数据）
• Sheet2: 共享费用
• Sheet3: 全局收支核对`,
      },
    ],
  },
  {
    icon: BarChart3,
    title: '第四步：看板与图表',
    items: [
      {
        sub: '首页看板',
        detail: `月度总览KPI卡片，展示：
• 总销售额、净收入、平均利润率、总SKU数
• 按KPI按目标货币显示
• 店铺筛选器切换汇总/单店数据`,
      },
      {
        sub: '趋势图表',
        detail: `• 销售额趋势：月度变化折线图
• 利润趋势：净收入变化
• 利润率变化：利润率走势
• 多店铺对比：按店铺分色展示`,
      },
      {
        sub: '费用分析',
        detail: `查看各费用项的占比和趋势，支持按店铺筛选。`,
      },
      {
        sub: '历史对比',
        detail: `多月份利润对比，查看各月数据变化趋势。`,
      },
    ],
  },
  {
    icon: DollarSign,
    title: '汇率管理',
    items: [
      {
        sub: '默认汇率',
        detail: `设置通用的货币转换汇率，作为所有月份的兜底汇率。
例如：USD→CNY = 7.24，EUR→CNY = 7.85`,
      },
      {
        sub: '月度汇率',
        detail: `支持为每个月单独设置汇率，适用于汇率波动较大的场景。
查看某月数据时，优先使用该月的月度汇率，没有则回退到默认汇率。`,
      },
    ],
  },
  {
    icon: Settings,
    title: '设置与数据管理',
    items: [
      {
        sub: '店铺管理',
        detail: `• 新增店铺：输入店铺名称、选择货币、填写默认负责人
• 编辑店铺：修改名称、货币、负责人
• 删除店铺：确认后删除该店所有数据（至少保留一个店铺）`,
      },
      {
        sub: '数据存储',
        detail: `所有数据存储在浏览器本地（IndexedDB），包括：
• 交易记录、利润报表
• 店铺信息、汇率配置
• 负责人映射表
⚠️ 清除浏览器缓存会丢失数据，建议定期导出Excel备份`,
      },
    ],
  },
  {
    icon: Table,
    title: '报表类型详解',
    items: [
      {
        sub: '交易明细（必传）',
        detail: `从亚马逊后台下载的 Settlement 报告，这是利润计算的基础数据。
包含订单、退款、FBA费用、仓储费等各项交易明细。`,
      },
      {
        sub: '产品成本表（推荐）',
        detail: `上传采购成本/FOB价格，替换交易明细中的成本估算，使利润更准确。
支持列名：SKU、FOB、成本价、采购价、cost、unit_cost等`,
      },
      {
        sub: '尾程运费表（推荐）',
        detail: `上传海外仓配送费，替换交易明细中的运费估算。
支持列名：SKU、订单号、尾程运费、配送费、运费、shipping_fee等`,
      },
      {
        sub: '其他辅助报表',
        detail: `• 仓储费报告：补充月度仓储费数据
• 广告报告：补充广告花费数据
• 结算报告：交叉验证总利润
• 退货报告：交叉验证退款数据`,
      },
    ],
  },
  {
    icon: RefreshCw,
    title: '数据更新与维护',
    items: [
      {
        sub: '月度更新流程',
        detail: `① 在数据导入页选择店铺，上传该月各类报表
② 系统自动合并分析，生成利润报表
③ 在利润表页查看完整41列数据
④ 导出Excel保存备份`,
      },
      {
        sub: '历史数据',
        detail: `系统按月保存历史报表，可在历史对比页查看各月数据变化。
同一月份重新上传会覆盖该月数据。`,
      },
    ],
  },
  ];

export default function HelpPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-emerald-700">使用说明</h1>
        <p className="text-muted-foreground mt-2">
          亚马逊利润报表系统完整使用指南
        </p>
      </div>

      <div className="space-y-5">
        {sections.map((section, i) => (
          <Card key={i} className="shadow-sm border-0 bg-card rounded-xl">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <section.icon className="w-5 h-5 text-emerald-600" />
                {section.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {section.content && (
                <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
                  {section.content}
                </p>
              )}
              {section.items?.map((item, j) => (
                <div key={j}>
                  <h4 className="font-medium text-sm text-emerald-700 mb-1">
                    ▸ {item.sub}
                  </h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed pl-4">
                    {item.detail}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}