# 玩家累计盈亏蜡烛图设计

## 背景

玩家详情页当前通过 Recharts 折线图展示每场牌局结算后的累计 CNY 或累计筹码。折线可以表达长期趋势，但无法同时展示一场牌局的资金投入、结算结果和单场盈亏方向。

本设计为现有图表新增股票蜡烛式视图。蜡烛不是传统证券行情 OHLC：系统目前只有买入记录和最终结算筹码，没有牌局过程中的真实最高盈利。第一阶段使用可验证的账本数据构造累计盈亏蜡烛，并明确区分真实字段与合成上界。

当前代码已经在同一次查询中读取 `buy_in.amount` 和 `session_participant.final_chips`，但 `resultsBySession` 只向下游暴露净筹码，导致图表层无法得到总买入和最终筹码。本功能不需要数据库迁移，也不需要增加数据库请求。

## 目标

- 保留现有累计折线图，新增可切换的蜡烛视图。
- 折线和蜡烛视图均支持 CNY 与 CHIPS 两种计价模式。
- 蜡烛实体准确表达单场净盈亏，影线表达该场账本买入形成的资金暴露下界。
- Tooltip 展示买入次数、实际总买入、最终结算筹码、单场净结果和累计结果。
- 保持现有 BEST/WORST 判定、点击进入 session 详情和累计统计不变。
- 在不引入新图表依赖的前提下兼容桌面端、移动端及高密度历史数据。

## 非目标

- 第一阶段不采集牌局过程快照，也不新增真实最高盈利字段。
- 不把合成 `high` 描述为真实牌局峰值。
- 不修改结算、守恒校验、排行榜排序或 session 历史表格的账务规则。
- 不持久化用户选择的图表类型或计价模式。
- 不更换 Recharts，不引入专业金融图表库。
- 不追溯修正通过净结果导入而生成的历史买入数据。

## 已确认决策

1. 最低点基于数据库中实际买入金额之和，而不是由买入次数乘以固定 2000 反推。
2. 图表采用累计坐标：开盘为上一场累计值，收盘为本场结算后的累计值。
3. 缺少真实最高盈利时，`high = max(open, close)`；赢局等于收盘，亏局等于开盘。
4. 保留现有折线图，通过 `LINE / CANDLE` 分段控件切换，默认仍为 `LINE`。
5. `CNY / CHIPS` 与图表类型是两个独立的本地状态，默认仍为 `CNY`。
6. 继续使用 Recharts，通过区间 Bar 和自定义 shape 绘制蜡烛。

## 业务口径

### 基础结算字段

对按时间排序后的第 `i` 场牌局，定义：

- `B_i`：该玩家本场所有未删除 `buy_in.amount` 的总和。
- `K_i`：该玩家本场未删除买入记录数量，仅用于 Tooltip 展示。
- `F_i`：原始 `session_participant.final_chips`，类型为 `number | null`。
- `E_i = F_i ?? 0`：参与结算公式的有效最终筹码，与现有 `netChips` 语义一致。
- `N_i = E_i - B_i`：本场净筹码，继续由现有 `netChips` 规则产生。
- `R_i`：本场筹码兑 CNY 的 `exchange_rate`。

### CHIPS 蜡烛

设 `P_(i-1)` 为上一场结算后的累计净筹码，首场之前为 0：

```text
open_i  = P_(i-1)
close_i = open_i + N_i
low_i   = open_i - B_i
high_i  = max(open_i, close_i)
```

因为 `E_i >= 0`，所以 `low_i <= close_i`；结合 `high_i` 的定义，可以保证：

```text
low_i <= min(open_i, close_i) <= max(open_i, close_i) <= high_i
```

相邻蜡烛必须满足：

```text
close_i = open_(i+1)
```

### CNY 蜡烛

CNY 模式保持当前“逐场换算、保留两位小数后累计”的行为，避免改变现有总额：

```text
net_cny_i   = toCny(N_i, R_i)
buyin_cny_i = toCny(B_i, R_i)

open_i  = previous_cumulative_cny
close_i = open_i + net_cny_i
low_i   = open_i - buyin_cny_i
high_i  = max(open_i, close_i)
```

Tooltip 中的总买入和最终筹码优先展示筹码原值；单场结果与累计结果按当前计价模式格式化，避免分别换算买入和结算后因四舍五入产生 0.01 CNY 的视觉差异。

### 颜色

- `N_i > 0`：绿色，表示本场净赢。
- `N_i < 0`：红色，表示本场净亏。
- `N_i === 0`：灰色，表示本场持平。

颜色始终由未换算的净筹码 `N_i` 判定，不由当前模式下经过舍入的 open/close 判定。CNY 模式中，绝对值极小的非零净筹码可能被 `toCny` 舍入为 `0.00`，此时几何上显示为绿色或红色的水平 doji，而不是灰色持平。

## 数据架构

### 账本聚合层

新增无数据库依赖的 `lib/session-results.ts`，作为查询结果到统计输入之间的纯数据边界。它定义 `ResultEntry` 和原始行类型，并导出：

```ts
function buildResultsBySession(
  participants: ParticipantResultRow[],
  buyIns: BuyInResultRow[],
): Map<string, ResultEntry[]>
```

该函数按 `(session_id, player_id)` 聚合买入总额和次数，保留原始 `final_chips`，并且只通过 `netChips` 计算净值。输入必须是查询层已经过滤过删除标记的行；该模块不重复解释数据库删除语义。

`ResultEntry`：

```ts
interface ResultEntry {
  player_id: string
  chips: number
  final_chips: number | null
  total_buyin: number
  buy_in_count: number
}
```

这个边界使买入次数、实际总买入、null 最终筹码和净值映射可以在不连接 Supabase 的情况下完整单测。

### 查询层

`lib/queries.ts` 继续作为数据库读取边界。

`resultsBySession` 保留现有两条 Supabase 查询及其 `.is('deleted_at', null)` 条件，把返回的 participant 和 buy-in 行交给 `buildResultsBySession`。因此不会增加数据库请求，也不会在查询模块中保留第二份聚合公式。

`getPlayerDetail` 将目标玩家对应的 `final_chips`、`total_buyin` 和 `buy_in_count` 放入 `PlayerHistoryEntry`。同一场其他玩家的扩展字段可由排行榜和 POG 逻辑忽略。

玩家历史 session 增加已有的 `started_at` 字段用于稳定排序。`date` 是数据库现有的 ISO `YYYY-MM-DD` 日期，按字符串比较；非 null `started_at` 通过 `Date.parse` 转换为绝对时间戳比较，不依赖浏览器本地时区。排序比较规则依次为：

1. `date` 升序。
2. 同日时，可解析的 `started_at` 排在 null 或不可解析值之前。
3. 两者均可解析时按绝对时间戳升序。
4. 两者时间相同，或均为 null/不可解析值时，按 `session_id` 升序。

这样同一天有多场牌局时，累计蜡烛顺序、Tooltip 命中和点击跳转都保持确定。

### 统计层

`lib/stats.ts` 继续承担全部派生统计。新增稳定的图表数据契约：

```ts
interface CandlePoint {
  open: number
  high: number
  low: number
  close: number
}

interface HistoryPoint {
  // 保留现有字段
  date: string
  session_id: string
  chips: number
  cumulative: number
  cny: number
  cumulative_cny: number
  description: string | null

  // 新增账本与蜡烛字段
  buy_in_count: number
  total_buyin: number
  final_chips: number | null
  chips_candle: CandlePoint
  cny_candle: CandlePoint
}
```

`computePlayerHistory` 在同一次顺序遍历中先记录 open，再计算本场 close、low 和 high，最后更新累计值。图表组件不重新计算任何账务公式，只根据模式选择 `chips_candle` 或 `cny_candle`。Recharts 所需的 `[low, high]` 由 `Bar.dataKey` 直接从这两个字段组成，不在数据契约中存储冗余 range。

### 几何层

新增无 React 依赖的 `lib/candle-geometry.ts`。其中的纯几何函数接收 Recharts 提供的区间像素边界以及 payload 中的 OHLC，输出影线与实体坐标；纯方向函数接收原始净筹码并返回 `up | down | flat`。`CandleShape` 只把方向映射为现有绿色、红色或中性色。

数值到像素的映射为：

```text
yOf(value) = y + ((high - value) / (high - low)) * height
```

特殊情况：

- `high === low` 时直接返回水平 doji 坐标，避免除零。
- `open === close` 时绘制至少 1px 的水平线，不依赖零高度 `<rect>`。
- 非有限数值或缺失 payload 时不绘制该 shape，避免污染 SVG。
- 不使用 Recharts 的 `minPointSize`，因为它会修改区间 `y/height` 并破坏映射比例。

## 组件设计

### `PlayerStatsChart`

职责：持有页面级展示状态和渲染图表工具栏。

- 保留 `mode: 'cny' | 'chips'`。
- 新增 `chartType: 'line' | 'candle'`，默认 `line`。
- 使用两组独立分段控件：`LINE / CANDLE` 与 `CNY / CHIPS`。
- 每个选项使用原生 `button`，通过 `aria-pressed` 暴露选中状态；Tab 可聚焦，Enter/Space 使用浏览器原生按钮行为切换。
- 状态仅保存在当前组件生命周期内，不写 URL、localStorage 或数据库。
- 将 `mode` 与 `chartType` 传给 `PlayerChart`。
- 有一条历史记录时也显示图表；无历史记录时不显示空图。

### `PlayerChart`

职责：提供 Line 与 Candle 共用的 Recharts 容器、坐标轴、零线、Tooltip 和路由行为。

- 将当前 `LineChart` 替换为可同时承载 `Line` 或 `Bar` 的 `ComposedChart`。
- `chartType === 'line'` 时保持现有 Line、dot、activeDot 和 BEST/WORST 行为。
- `chartType === 'candle'` 时渲染一个区间 `Bar`，其 `dataKey` 从当前模式的 `CandlePoint` 返回 `[point.low, point.high]`。
- X 轴使用唯一 `session_id` 作为 category key，通过 tick formatter 显示 `date`，不直接把可能重复的日期作为定位键。
- Y 轴继续使用当前金额格式和零参考线，并让区间 Bar 的 low/high 参与 domain 计算。
- Tooltip 继续从 Recharts payload 读取完整 `HistoryPoint`，不依赖 Bar 的区间 value。
- 图表外层保持现有固定高度，预留顶部和底部 margin，防止 BEST/WORST 文本被裁切。

### `CandleShape`

职责：只把一个 `HistoryPoint` 绘制成一个可交互 SVG 蜡烛。

- 根据当前 `mode` 从 `payload.chips_candle` 或 `payload.cny_candle` 读取 open/high/low/close，并从 payload 读取 session_id；不能依赖 shape props 的 `value`，因为区间 Bar 的该值不保证保留完整 tuple。
- 影线覆盖 low 到 high，实体覆盖 open 到 close。
- 实体宽度限制在当前 category 宽度内；高密度数据下允许缩小到细线，但不与相邻蜡烛重叠。
- 增加不超过 category 宽度的透明命中矩形，扩大移动端点击区域。
- 点击或轻触后进入 `/sessions/{session_id}`，与现有折线 dot 一致。
- 可交互 SVG group 提供 `role="button"`、`tabIndex=0` 和 session 日期的可访问名称，Enter/Space 与点击执行同一跳转。
- BEST/WORST 仍以单场净结果 `chips` 或 `cny` 判定，不以 low/high 判定；标签锚定在实体附近。当 `bestIdx === worstIdx`（例如只有一场或所有场次结果相同）时，两个标签均不显示，避免重叠且不为无差异数据制造排名含义。
- 关闭 Candle 系列动画，保证切换模式和几何投影稳定；折线现有动画行为不变。

## 交互与 Tooltip

### 模式切换

- 初始状态：`LINE + CNY`，保持现有用户体验。
- 两组控件可独立组合，形成 LINE/CANDLE × CNY/CHIPS 四种状态。
- 切换只改变展示，不重新请求数据。
- 控件使用稳定尺寸，切换 active 状态时不改变布局宽度。

### Tooltip 内容

Tooltip 统一展示真实业务数据：

1. 日期。
2. 买入次数和实际总买入筹码。
3. 最终结算筹码；原始值为 null 时显示 `—`。
4. 单场净结果，按当前模式显示 CHIPS 或 CNY。
5. 累计结果，按当前模式显示 CHIPS 或 CNY。
6. 可选的 session 描述。

Tooltip 不展示“最高盈利”文案，也不把 `high = max(open, close)` 解释为牌局过程峰值。

### 响应式行为

- 桌面端保持现有 220px 图表高度和整体排版。
- 移动端不新增横向滚动；Recharts 根据 category 宽度压缩实体，并通过透明命中区维持可点击性。
- 日期刻度继续由 Recharts 按可用宽度抽样，首尾日期应保留。
- 40 场以上历史数据仍需可辨认整体趋势；单根实体最小视觉宽度和命中宽度分开处理。

## 历史数据与异常处理

### 净结果导入场次

通过 `synthFromNet` 导入的历史场次只有净结果，系统会合成一笔买入和最终筹码以满足结算等式。这些数据库行无法与实时记录的真实买入区分。

第一阶段将数据库中的未删除 `buy_in` 视为账本事实，因此这些场次的 low 也是合成账本值，不代表真实牌局内资金过程。界面统一使用“buy-ins / total”表述，不使用“真实最低点”或“实际峰值”等文案。若未来需要区分，必须另行设计来源标识和数据迁移，不在本功能范围内。

### 数据边界

- 只展示现有查询筛选出的 `SETTLED`、未删除 session。
- 买入总额为 0 时，low 等于 open；仍可按结算结果绘制实体。
- `final_chips` 为 null 时沿用当前 `netChips` 行为保证累计统计不变，Tooltip 最终筹码显示 `—`。
- 全零区间绘制单个 doji，不让图表组件抛错。
- 无法形成有限坐标的异常点不绘制 CandleShape；其他场次和折线模式继续可用。

## 未采用方案

### 完全自定义 SVG 图表层

可以获得最大的绘制控制，但需要自行维护坐标轴换算、Tooltip 命中和响应式行为。当前 Recharts 已提供区间 Bar 和 shape 扩展点，没有必要承担额外维护成本。

### 引入专业金融图表库

专业库原生支持传统 OHLC，但会增加依赖，并要求重做现有主题、Tooltip、点击路由和 CNY/CHIPS 切换。本需求只有一个累计盈亏蜡烛系列，收益不足以覆盖集成成本。

### 始终令 `high = close`

亏损场次中 close 小于 open，始终令 high 等于 close 会违反 `high >= max(open, close)`，产生无效 OHLC。使用 `max(open, close)` 可以在没有真实峰值时保持合法图形，并且不伪造上影线。

## 测试策略

### 账本聚合测试

为 `buildResultsBySession` 增加独立 Vitest 测试，覆盖：

- 同一玩家首次买入与多次补买的总额和次数。
- 多 session、多玩家数据不会串组。
- 非 2000 买入金额按原值求和。
- 原始 `final_chips` 完整透传，null 时 `chips` 使用 `(final_chips ?? 0) - total_buyin`。
- 没有买入行的 participant 得到总额 0、次数 0。

Supabase 查询继续使用现有 `.is('deleted_at', null)` 过滤 participant 与 buy-in；纯聚合函数只接收过滤后的行，不重复测试数据库客户端本身的过滤行为。

### 统计与账务测试

扩展 `lib/stats.test.ts`，覆盖：

- 赢局、亏局、持平和最终筹码为 0 的全损场次。
- 首次买入加任意次数补买。
- 存在非 2000 金额的买入，验证 low 使用实际总额而不是次数反推。
- CHIPS 与不同 exchange rate 下的 CNY 蜡烛。
- 非零净筹码舍入为 `0.00` CNY 时，几何为 doji，但颜色仍按原始筹码正负判定。
- `low <= open/close <= high`。
- 每根 `close` 等于下一根 `open`。
- 同日多场中混合有效/null/不可解析 `started_at`、相同时间戳和全部 null 时，排序均符合明确规则。
- 既有累计值、总额、胜场和 POG 结果不回归。

### 几何测试

为纯几何函数增加 Vitest 测试，覆盖：

- 上涨实体、下跌实体和持平 doji。
- `high === low` 的全零区间。
- 极小像素跨度和最小实体宽度。
- 无效数值与缺失 payload 不产生非法 SVG 坐标。

现有 Vitest 只收集 `lib/**/*.test.ts`，将几何投影放在 `lib` 纯函数中可以直接纳入当前测试体系，不需要引入 DOM 测试框架。

### 浏览器验收

- 先用最小数据集验证 Recharts 3.8.1 对 tuple domain、自定义 shape payload、全零 range 和模式切换的实际行为。
- 桌面与移动端视口。
- 1 场、2 场和 40 场以上历史数据。
- LINE/CANDLE × CNY/CHIPS 四种组合。
- BEST/WORST、Tooltip 内容和金额格式。
- 单场及所有结果相同的数据不显示重叠的 BEST/WORST 标签。
- 同日多场的 hover/tap 命中。
- 点击蜡烛跳转正确 session。
- 分段控件的 `aria-pressed`、Tab 焦点与 Enter/Space 切换可用；蜡烛的键盘跳转可用。
- 图表文字、工具栏、Tooltip 和下方历史表格无重叠。

### 回归命令

```bash
npm test
npm run build
```

## 验收标准

1. 玩家详情页保留折线默认视图，并能切换到蜡烛视图。
2. CNY 与 CHIPS 模式中的 open、low、high、close 均符合本设计公式。
3. 蜡烛颜色准确反映单场净盈亏，持平局显示为中性色 doji。
4. Tooltip 使用实际账本总买入和原始结算筹码，不把合成 high 描述为真实峰值。
5. 同日多场、单场玩家和高密度历史数据可正常展示和交互。
6. 点击蜡烛可进入对应 session 详情。
7. 现有累计统计、BEST/WORST、折线视图和 session 历史表格无行为回归。
8. 不新增数据库迁移、数据库请求或图表依赖。
9. 完整测试和生产构建通过。

## 后续扩展

若未来需要真实最高盈利，必须记录牌局过程中的玩家筹码快照和截至该时刻的累计买入。届时可在统计层将真实过程峰值映射到累计坐标并替换 `high`，查询与图表契约保持不变。本扩展需单独设计数据采集频率、历史迁移和存储成本。
