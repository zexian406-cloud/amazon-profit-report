# DESIGN.md

## 气质与意象
- Apple 设计语言：简洁、高级、大量留白
- 类比 Apple Health / 钱包 App 的极简数据卡片风格
- 纯白背景衬托内容，浅灰分区做层次
- 整体基调：克制、精致、通透

## 配色方案
- 页面背景：纯白 #FFFFFF
- 分区背景：浅灰 #F5F5F7
- 卡片背景：纯白，带轻微阴影
- 侧边栏：极深色 #1D1D1F
- 主文字：深黑 #1D1D1F
- 次要文字：中灰 #6E6E73
- 主色：Apple 蓝 #007AFF
- 盈利色：Apple 绿 #34C759
- 亏损色：Apple 红 #FF3B30
- 警告色：#FF9500
- 分割线：极浅 #E5E5EA

## 字体排版
- 英文字体：Inter（Google Fonts），细体/常规/中粗
- 中文字体：PingFang SC 系统字体兜底
- 大号数字：text-4xl/tabular-nums，Apple 健康 App 风格
- 字号层级：page-title text-3xl font-semibold → section-title text-lg font-medium → body text-sm → caption text-xs
- 行距宽松（leading-relaxed），减少密集感

## 布局与响应式
- 侧边栏固定宽度 w-60，极简深色，无图标装饰
- 内容区 padding 8-12，最大宽度 1200px
- 数据卡片 3-4 列网格，大号数字 + 极简标签
- 大量留白：卡片间距 6，内边距 6-8

## 组件规范
### 卡片
- 背景纯白，圆角 16px，shadow-sm 轻微阴影
- 无边框，大量内边距
- 苹果健康 App 风格：大号数字在上，极简标签在下

### 表格
- 极简线条：border-b border-[#E5E5EA] 细线
- 表头：text-xs font-medium text-[#6E6E73]
- 行高 44px，hover 行浅灰背景
- 数字列右对齐 + tabular-nums

### 按钮
- 填充色圆角按钮：rounded-xl px-5 py-2.5
- 主按钮：bg-[#007AFF] text-white
- 次按钮：bg-[#F5F5F7] text-[#1D1D1F]
- 无渐变，无复杂动画

### 侧边栏导航
- 背景 #1D1D1F，无图标，纯文字导航
- 每个导航项 36px 高，圆角 8px
- 激活态：bg-white/10 text-white
- hover：bg-white/5
- 文字 14px，无图标减少视觉噪声

### 标签/Badge
- 圆角 20px（pill 形状），px-3 py-0.5
- 绿底（#34C759）、红底（#FF3B30）、琥珀底（#FF9500）

## 交互与状态
- 卡片 hover 轻微上浮 shadow-md
- 表格行 hover 背景变色
- 按钮点击无缩放效果
- 页面切换无感过渡
- 弹窗居中，背景半透明

## 动效
- 过渡统一 ease-out duration-200
- 极少动画，以稳定高效为主
- 仅卡片 hover 有动效

## 设计禁忌
- ❌ 禁止使用毛玻璃效果
- ❌ 禁止使用渐变
- ❌ 禁止粗边框，用阴影替代
- ❌ 禁止圆角过小（最小 8px）
- ❌ 禁止装饰性图标过多
- ❌ 禁止字体过小（不低于 12px）
- ❌ 禁止饱和度高的色块