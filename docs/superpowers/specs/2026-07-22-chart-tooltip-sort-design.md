# Chart Tooltip 筹码量排序设计

## 背景

Leaderboard 的 chart 模式使用 Recharts 默认 Tooltip。当前未配置 Tooltip 的条目排序，Recharts 3.8.1 默认按系列名称排序，因此 hover 某个日期时，玩家详情不是按该日期对应的累计筹码量排列。

## 目标

- Tooltip 中的玩家详情按当前显示值从高到低排序。
- 当两位玩家数值相同时，按玩家名称升序排列，保证顺序稳定。
- CNY 和 CHIPS 两种模式使用相同规则。
- 不改变曲线、图例、颜色、金额格式或玩家筛选行为。

## 方案

新增一个纯排序函数，接收 Recharts 提供的 tooltip payload，复制后按以下规则排序：

1. 将条目的 `value` 转换为数值，按降序比较。
2. 数值相同时，将 `name` 转换为字符串并按升序比较。
3. 不原地修改 Recharts 传入的 payload。

`LeaderboardChart` 使用自定义 tooltip content 回调。在回调中调用该排序函数，再把排序后的 payload 和其余属性交给 Recharts 的 `DefaultTooltipContent` 渲染。这样可以复用现有默认结构、formatter、颜色和样式，同时支持两级排序。

不采用 Tooltip 的 `itemSorter`，因为当前 Recharts 版本只支持单个排序键，不能可靠表达“数值降序、同值名称升序”。也不完全重写 Tooltip，以避免重复已有的展示逻辑。

## 数据流

hover 日期 -> Recharts 生成该日期的 payload -> 复制并排序 payload -> `DefaultTooltipContent` 按排序结果执行现有 formatter -> 展示详情。

## 边界处理

- 缺少或无法转换为有限数值的条目排在有效数值之后。
- 多个无效数值仍按名称升序排列。
- 玩家筛选继续由现有 formatter 控制，不在排序函数中重复处理。

## 测试

为纯排序函数增加 Vitest 回归测试，验证：

- 正数、零和负数按数值降序排列。
- 数值相同时按名称升序排列。
- 输入 payload 的原始顺序不被修改。

最后运行完整 Vitest 测试和 Next.js 构建。
