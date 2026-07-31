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
    content: `纯前端亚马逊利润报表工具，自动解析亚马逊后台报表并生成SKU级利润分析。数据存储在浏览器本地，无需服务器。`,
  },
  {
    icon: FileUp,
    title: '数据导入',
    items: [
      {
        sub: '支持的报表类型',
        detail: `交易明细（必传）、结算报告、仓储费报告、广告报告、退货报告、产品成本/FOB、尾程运费、负责人映射表（可选）`,
      },
      {
        sub: '操作步骤',
        detail: `选择店铺 → 选择报表类型 → 上传Excel → 确认解析预览 → 点击「计算利润」生成报表`,
      },
      {
        sub: '负责人映射（可选）',
        detail: `上传含"品名、SKU、负责人"三列的Excel，建立SKU→负责人映射。利润表优先使用映射数据，未匹配则用店铺默认负责人。`,
      },
    ],
  },
  {
    icon: Store,
    title: '多店铺管理',
    items: [
      {
        sub: '店铺设置',
        detail: `在「店铺管理」页面新增/编辑/删除店铺，为每个店铺设置货币单位和默认负责人。`,
      },
      {
        sub: '数据筛选',
        detail: `所有页面顶部筛选器可选择「全部」查看汇总数据，或选择具体店铺查看独立数据。`,
      },
    ],
  },
  {
    icon: Calculator,
    title: '利润表查看',
    items: [
      {
        sub: '41列SKU利润表',
        detail: `自动生成完整41列利润表，涵盖商品收入、佣金、FBA费用、仓储费、其他费用、外部成本（广告/头程/产品成本/尾程运费）、汇总净收入及负责人。`,
      },
      {
        sub: '汇率换算',
        detail: `利润表顶部可选择「显示货币」切换展示币种。优先使用该月的月度汇率，没有则用默认汇率。`,
      },
      {
        sub: '导出Excel',
        detail: `点击「导出Excel」生成包含3个Sheet的文件：SKU利润表（41列）、共享费用、全局收支核对。`,
      },
    ],
  },
  {
    icon: BarChart3,
    title: '看板与图表',
    content: `首页展示月度KPI（销售额、净收入、利润率、SKU数）。趋势图表展示销售额/利润/利润率变化趋势，多店铺按色区分。费用分析页查看各费用项占比，历史对比页查看多月份利润对比。`,
  },
  {
    icon: DollarSign,
    title: '汇率管理',
    content: `设置各货币对间的默认汇率（如USD→CNY=7.24）作为兜底。支持为每个月单独配置汇率，适用于汇率波动较大的场景，查看时优先使用月度汇率。`,
  },
  {
    icon: Settings,
    title: '设置与数据管理',
    items: [
      {
        sub: '店铺管理',
        detail: `新增/编辑/删除店铺，配置货币单位与默认负责人。至少保留一个店铺。`,
      },
      {
        sub: '海外仓费用类型',
        detail: `在设置页管理海外仓费用类型（新增/重命名/删除），利润表自动按配置生成动态列。`,
      },
    ],
  },
  {
    icon: Table,
    title: '报表类型详解',
    items: [
      {
        sub: '交易明细（必传）',
        detail: `Settlement报告，利润计算的基础数据，包含订单、退款、FBA费用等各项明细。`,
      },
      {
        sub: '产品成本表（推荐）',
        detail: `上传采购成本/FOB价格，替换交易明细中的成本估算，提升利润准确度。支持列名：SKU、FOB、成本价、采购价、cost、unit_cost等。`,
      },
      {
        sub: '尾程运费表（推荐）',
        detail: `上传海外仓配送费，替换交易明细中的运费估算。支持列名：SKU、订单号、尾程运费、配送费、运费、shipping_fee等。`,
      },
      {
        sub: '其他辅助报表',
        detail: `仓储费报告（补充月度仓储费）、广告报告（补充广告花费）、结算报告（交叉验证总利润）、退货报告（交叉验证退款数据）。`,
      },
    ],
  },
  {
    icon: RefreshCw,
    title: '数据更新',
    items: [
      {
        sub: '月度更新流程',
        detail: `选择店铺 → 上传该月各类报表 → 自动合并分析 → 查看利润表 → 导出Excel备份。`,
      },
      {
        sub: '历史数据',
        detail: `系统按月保存历史报表，可在历史对比页查看各月变化。同一月份重新上传会覆盖该月数据。`,
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-emerald-700">使用说明</h1>
        <p className="text-muted-foreground mt-2">亚马逊利润报表系统快速参考</p>
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