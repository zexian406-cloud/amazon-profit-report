# DESIGN.md

## 气质与意象
- 现代 SaaS 财务工作台，类比 Linear / Notion 的极简干净质感
- 暗色侧边栏 + 浅色内容区的经典双色布局，层次分明
- 数据是视觉主角，用留白、间距和细腻阴影让数字呼吸
- 整体基调：冷静、专业、克制，没有冗余装饰

## 配色方案
- 侧边栏：深灰（#111827 / oklch(0.2 0 0)）—— 沉稳、聚焦
- 内容区背景：暖白（#f8f9fc）
- 主色：翡翠绿（#0d9488 / oklch(0.55 0.12 175)）—— 现代、活力、与利润正相关
- 卡片背景：白色，带细微阴影（shadow-sm）
- 分割/边框：极浅灰（#f0f0f0），用阴影替代边框分割
- 状态色：绿（盈利/增长 #10b981）、红（亏损/下降 #ef4444）、琥珀（警告 #f59e0b）
- 图表色板：翡翠绿→青→蓝→橙→紫→粉（由主色温暖方向衍生）

## 字体排版
- 英文字体：Inter（Google Fonts），数字显示清晰
- 中文字体：PingFang SC / Microsoft YaHei（系统字体兜底）
- 字号层级：page-title text-2xl font-semibold → section-title text-lg font-medium → body text-sm → caption text-xs
- 数字突出：tabular-nums 等宽数字，方便纵向对比
- 行距宽松（leading-relaxed），减少密集感

## 布局与响应式
- 左侧固定暗色侧边栏（w-64，收起 w-16），带微光分割线
- 右侧内容区 padding: 8 ，
- KPI 卡片 4 列网格，md 降 2 列，sm 降 1 列
- 内容区最大宽度 1440px，居中

## 组件规范
### 卡片
- 背景白色，圆角 12px，shadow-sm 阴影，hover 时 shadow-md 过渡
- 内边距 24px，标题区与内容区用 divider 或间距分隔
- 无边框，用阴影和背景色区分层次

### 表格
- 表头：bg-muted/50 浅灰背景，text-sm font-medium
- 表体：text-sm，行高 48px，hover 行亮色（bg-muted/30）
- 粘性表头，圆角上角
- 数字列右对齐，文字列左对齐

### 按钮
- 主按钮：翡翠绿底色，白字，圆角 8px，px-4 py-2
- 次按钮：透明边框按钮
- hover 有亮度微调，点击有 scale 微反馈

### 标签/Badge
- 圆角 6px，px-2 py-0.5，font-medium
- 绿色（盈利/已同步）、红色（亏损/异常）、琥珀色（待处理）

### 输入框
- 圆角 8px，border-border/50，focus:ring-2 focus:ring-primary/20
- 高度 40px，内边距 12px
- 带图标时左侧内边距增加

### 侧边栏导航
- 每个导航项 44px 高，圆角 8px，hover 背景变亮
- 激活态：bg-primary/10 + text-primary font-medium
- 图标统一 20px，文字 14px
- 收起时只显示图标，tooltip 提示文字

## 交互与状态
- 侧边栏折叠展开有平滑宽度过渡（duration-300）
- 卡片 hover 轻微上浮（translateY(-1px) + shadow-md）
- 表格行 hover 背景变色
- 按钮点击有 scale(0.97) 微反馈
- 页面切换无感，数据加载时显示骨架屏
- 弹窗/对话框居中，背景半透明模糊（backdrop-blur-sm）

## 动效
- 过渡统一使用 ease-out duration-200
- 避免过度动画，财务工具以稳定高效为主
- 仅关键交互（侧边栏折叠、弹窗出现、卡片 hover）有动效

## 设计禁忌
- ❌ 禁止使用传统企业蓝（#1e3a5f 等深蓝主色）
- ❌ 禁止使用紫蓝渐变科技风格
- ❌ 禁止粗边框，用阴影替代
- ❌ 禁止圆角过大（不超过 12px）
- ❌ 禁止装饰性插图/图标过多
- ❌ 禁止字体过小（不低于 12px）
- ❌ 禁止大红大绿的饱和色块，状态色应柔和