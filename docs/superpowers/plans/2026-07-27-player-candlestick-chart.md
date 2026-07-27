# 玩家累计盈亏蜡烛图实施计划

> **供代理执行：** 必须使用 `superpowers:subagent-driven-development`（存在子代理时）或 `superpowers:executing-plans` 实施本计划。所有步骤使用 checkbox 跟踪，严格按 TDD 顺序执行。

**目标：** 在玩家详情页保留现有累计折线的同时，增加支持 CNY/CHIPS 的累计盈亏蜡烛视图，并准确展示实际买入、最终筹码和单场净结果。

**架构：** Supabase 查询继续读取现有 participant 与 buy-in 行，新的纯聚合模块生成统一 `ResultEntry`；`computePlayerHistory` 负责累计 OHLC，纯几何模块负责数值到 SVG 的投影。页面继续使用 Recharts，通过 `ComposedChart` 中的区间 `Bar` 与自定义 shape 绘制蜡烛，不新增数据库迁移、请求或图表依赖。

**技术栈：** Next.js 15、React 19、TypeScript、Recharts 3.8.1、Supabase、Vitest 4、Tailwind CSS 4。

**设计规格：** `docs/superpowers/specs/2026-07-27-player-candlestick-chart-design.md`

---

## 文件职责

| 文件 | 操作 | 单一职责 |
|------|------|----------|
| `lib/session-results.ts` | 新建 | 将已过滤的 participant/buy-in 行聚合为统一 session 结算结果 |
| `lib/session-results.test.ts` | 新建 | 验证总买入、次数、最终筹码和净值聚合 |
| `lib/queries.ts` | 修改 | 读取数据库并把原始行交给纯聚合模块；向玩家历史透传字段 |
| `lib/queries.test.ts` | 新建 | mock Supabase 查询链，验证删除过滤与扩展结果契约 |
| `lib/stats.ts` | 修改 | 确定性排序并生成 CHIPS/CNY 两套累计 OHLC |
| `lib/stats.test.ts` | 修改 | 验证 OHLC、CNY 舍入、排序与既有统计回归 |
| `lib/candle-geometry.ts` | 新建 | 计算蜡烛方向和 SVG 几何坐标 |
| `lib/candle-geometry.test.ts` | 新建 | 验证上涨、下跌、doji、零区间和非法输入 |
| `components/PlayerCandleShape.tsx` | 新建 | 将一个 HistoryPoint 渲染为可交互 SVG 蜡烛 |
| `lib/player-candle-shape.test.ts` | 新建 | 用服务端静态渲染验证 CandleShape 的颜色、标签和可访问属性 |
| `components/PlayerChart.tsx` | 修改 | 共享坐标轴/Tooltip，在 Line 与 Candle 系列之间切换 |
| `lib/player-chart.test.ts` | 新建 | mock Recharts，验证 Line/Candle 分支、range dataKey 和唯一 X 轴 |
| `components/PlayerStatsChart.tsx` | 修改 | 持有图表类型与计价模式状态，渲染两组分段控件 |
| `lib/player-stats-chart.test.ts` | 新建 | 静态渲染验证默认模式、单场可见和分段控件语义 |
| `app/candlestick-preview/page.tsx` | 临时创建后删除 | 为浏览器验收提供 1/2/41 场可控数据；绝不提交 |

## 实施约束

- 每个任务开始前确认工作区没有混入其他文件；任何 `.superpowers/` 可视化草稿都不得暂存。
- 若依赖尚未安装，先运行 `npm install`；不要修改 `package.json` 或 `package-lock.json`。
- 本地构建需要 Supabase 环境变量。没有 `.env.local` 时，可基于 `.env.example` 创建仅本地使用的配置，不得提交。
- 每个实现任务遵循：失败测试 -> 最小实现 -> 目标测试 -> 全量回归 -> 独立提交。
- 计划中的代码片段是目标接口；实现时只允许为 TypeScript/Recharts 3.8.1 的实际类型做最小适配，不得改变已批准的业务公式。

## Chunk 1：结算数据与累计 OHLC

### Task 1：建立可测试的 session 结算聚合边界

**Files:**
- Create: `lib/session-results.ts`
- Create: `lib/session-results.test.ts`
- Reference: `lib/settlement.ts:9-12`

- [ ] **Step 1：写聚合模块的失败测试**

创建 `lib/session-results.test.ts`，至少包含以下完整场景：

```ts
import { describe, expect, it } from 'vitest'
import { buildResultsBySession } from './session-results'

describe('buildResultsBySession', () => {
  it('aggregates actual buy-in totals and counts per session and player', () => {
    const result = buildResultsBySession(
      [
        { session_id: 's1', player_id: 'alice', final_chips: 7500 },
        { session_id: 's1', player_id: 'bob', final_chips: 0 },
        { session_id: 's2', player_id: 'alice', final_chips: 2100 },
      ],
      [
        { session_id: 's1', player_id: 'alice', amount: 2000 },
        { session_id: 's1', player_id: 'alice', amount: 2000 },
        { session_id: 's1', player_id: 'alice', amount: 500 },
        { session_id: 's1', player_id: 'bob', amount: 4000 },
      ],
    )

    expect(result.get('s1')).toEqual([
      {
        player_id: 'alice',
        chips: 3000,
        final_chips: 7500,
        total_buyin: 4500,
        buy_in_count: 3,
      },
      {
        player_id: 'bob',
        chips: -4000,
        final_chips: 0,
        total_buyin: 4000,
        buy_in_count: 1,
      },
    ])
    expect(result.get('s2')).toEqual([
      {
        player_id: 'alice',
        chips: 2100,
        final_chips: 2100,
        total_buyin: 0,
        buy_in_count: 0,
      },
    ])
  })

  it('preserves null final chips while using the existing effective-zero net rule', () => {
    const result = buildResultsBySession(
      [{ session_id: 's1', player_id: 'alice', final_chips: null }],
      [{ session_id: 's1', player_id: 'alice', amount: 2000 }],
    )

    expect(result.get('s1')?.[0]).toEqual({
      player_id: 'alice',
      chips: -2000,
      final_chips: null,
      total_buyin: 2000,
      buy_in_count: 1,
    })
  })
})
```

- [ ] **Step 2：运行测试并确认按预期失败**

Run:

```bash
npm test -- lib/session-results.test.ts
```

Expected: FAIL，错误包含无法解析 `./session-results` 或缺少 `buildResultsBySession`。

- [ ] **Step 3：实现最小聚合模块**

创建 `lib/session-results.ts`：

```ts
import { netChips } from './settlement'

export interface ParticipantResultRow {
  session_id: string
  player_id: string
  final_chips: number | null
}

export interface BuyInResultRow {
  session_id: string
  player_id: string
  amount: number
}

export interface ResultEntry {
  player_id: string
  chips: number
  final_chips: number | null
  total_buyin: number
  buy_in_count: number
}

interface BuyInAggregate {
  total: number
  count: number
}

function resultKey(sessionId: string, playerId: string): string {
  return `${sessionId}|${playerId}`
}

export function buildResultsBySession(
  participants: ParticipantResultRow[],
  buyIns: BuyInResultRow[],
): Map<string, ResultEntry[]> {
  const buyInsByKey = new Map<string, BuyInAggregate>()
  for (const buyIn of buyIns) {
    const key = resultKey(buyIn.session_id, buyIn.player_id)
    const current = buyInsByKey.get(key) ?? { total: 0, count: 0 }
    buyInsByKey.set(key, {
      total: current.total + buyIn.amount,
      count: current.count + 1,
    })
  }

  const results = new Map<string, ResultEntry[]>()
  for (const participant of participants) {
    const buyIn = buyInsByKey.get(resultKey(participant.session_id, participant.player_id))
      ?? { total: 0, count: 0 }
    const entries = results.get(participant.session_id) ?? []
    entries.push({
      player_id: participant.player_id,
      chips: netChips(participant.final_chips, buyIn.total),
      final_chips: participant.final_chips,
      total_buyin: buyIn.total,
      buy_in_count: buyIn.count,
    })
    results.set(participant.session_id, entries)
  }
  return results
}
```

- [ ] **Step 4：运行目标测试并确认通过**

Run: `npm test -- lib/session-results.test.ts`

Expected: PASS，2 tests passed。

- [ ] **Step 5：运行全量测试**

Run: `npm test`

Expected: PASS，现有 settlement、synth、stats 测试均无回归。

- [ ] **Step 6：提交聚合模块**

```bash
git add lib/session-results.ts lib/session-results.test.ts
git commit -m "feat: add session result aggregation"
```

### Task 2：接通查询层并透传玩家结算字段

**Files:**
- Modify: `lib/queries.ts:1-55`
- Modify: `lib/queries.ts:272-318`
- Create: `lib/queries.test.ts`
- Modify: `lib/stats.test.ts:5-93`
- Reference: `lib/session-results.ts`

- [ ] **Step 1：写查询适配器的失败测试**

创建 `lib/queries.test.ts`，用 hoisted mock 替换 `./db`，完整验证两条结果查询、删除过滤和字段透传：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./db', () => ({ db: { from: mocks.from } }))

import { getLeaderboardSessions, getPlayerDetail } from './queries'

function makeQuery(data: unknown[]) {
  const query = {
    select: vi.fn(),
    is: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    in: vi.fn(),
    single: vi.fn(),
    then: Promise.resolve({ data }).then.bind(Promise.resolve({ data })),
  }
  query.select.mockReturnValue(query)
  query.is.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  query.order.mockResolvedValue({ data })
  query.in.mockResolvedValue({ data })
  query.single.mockResolvedValue({ data: data[0] ?? null })
  return query
}

describe('getLeaderboardSessions', () => {
  beforeEach(() => mocks.from.mockReset())

  it('loads non-deleted settlement rows and exposes buy-in details', async () => {
    const sessions = makeQuery([{ id: 's1', date: '2026-01-10', exchange_rate: 40 }])
    const participants = makeQuery([
      { session_id: 's1', player_id: 'alice', final_chips: 5000 },
    ])
    const buyIns = makeQuery([
      { session_id: 's1', player_id: 'alice', amount: 2000 },
      { session_id: 's1', player_id: 'alice', amount: 500 },
    ])

    mocks.from.mockImplementation((table: string) => {
      if (table === 'session') return sessions
      if (table === 'session_participant') return participants
      if (table === 'buy_in') return buyIns
      throw new Error(`Unexpected table: ${table}`)
    })

    const result = await getLeaderboardSessions()

    expect(participants.select).toHaveBeenCalledWith('session_id, player_id, final_chips')
    expect(participants.is).toHaveBeenCalledWith('deleted_at', null)
    expect(buyIns.select).toHaveBeenCalledWith('session_id, player_id, amount')
    expect(buyIns.is).toHaveBeenCalledWith('deleted_at', null)
    expect(result[0].session_entries).toEqual([{
      player_id: 'alice',
      chips: 2500,
      final_chips: 5000,
      total_buyin: 2500,
      buy_in_count: 2,
    }])
  })
})

describe('getPlayerDetail', () => {
  beforeEach(() => mocks.from.mockReset())

  it('selects stable session time and forwards this player settlement fields', async () => {
    const player = makeQuery([{ id: 'alice', name: 'Alice' }])
    const myParts = makeQuery([{ session_id: 's1' }])
    const sessions = makeQuery([{
      id: 's1',
      date: '2026-01-10',
      description: null,
      exchange_rate: 40,
      started_at: '2026-01-10T12:00:00Z',
    }])
    const resultParts = makeQuery([
      { session_id: 's1', player_id: 'alice', final_chips: 5000 },
    ])
    const buyIns = makeQuery([
      { session_id: 's1', player_id: 'alice', amount: 2000 },
      { session_id: 's1', player_id: 'alice', amount: 500 },
    ])
    let participantCall = 0

    mocks.from.mockImplementation((table: string) => {
      if (table === 'player') return player
      if (table === 'session') return sessions
      if (table === 'session_participant') {
        participantCall += 1
        return participantCall === 1 ? myParts : resultParts
      }
      if (table === 'buy_in') return buyIns
      throw new Error(`Unexpected table: ${table}`)
    })

    const result = await getPlayerDetail('alice')

    expect(sessions.select)
      .toHaveBeenCalledWith('id, date, description, exchange_rate, started_at')
    expect(result?.entries[0]).toMatchObject({
      session_id: 's1',
      chips: 2500,
      final_chips: 5000,
      total_buyin: 2500,
      buy_in_count: 2,
      sessions: { started_at: '2026-01-10T12:00:00Z' },
    })
  })
})
```

- [ ] **Step 2：运行查询测试并确认失败**

Run: `npm test -- lib/queries.test.ts`

Expected: FAIL；排行榜 entry 缺少扩展字段，玩家详情 entry 缺少扩展字段和 `started_at`。

- [ ] **Step 3：让查询层改用纯聚合模块**

在 `lib/queries.ts`：

1. 删除本地 `ResultEntry` 接口和 `resultsBySession` 内的聚合循环。
2. 从 `./session-results` 导入 `buildResultsBySession` 及相关类型。
3. 保留 participant 与 buy-in 两条查询和两处 `.is('deleted_at', null)`。
4. 将查询结果强转为纯行类型后传给 `buildResultsBySession`。
5. 从 `lib/queries.ts` 重新导出 `ResultEntry` 类型，避免现有消费者立即改 import。

目标结构：

```ts
import {
  buildResultsBySession,
  type BuyInResultRow,
  type ParticipantResultRow,
} from './session-results'
import type { ResultEntry } from './session-results'

export type { ResultEntry } from './session-results'

async function resultsBySession(sessionIds: string[]): Promise<Map<string, ResultEntry[]>> {
  if (sessionIds.length === 0) return new Map()
  const [{ data: parts }, { data: buyins }] = await Promise.all([
    db.from('session_participant')
      .select('session_id, player_id, final_chips')
      .is('deleted_at', null)
      .in('session_id', sessionIds),
    db.from('buy_in')
      .select('session_id, player_id, amount')
      .is('deleted_at', null)
      .in('session_id', sessionIds),
  ])
  return buildResultsBySession(
    (parts ?? []) as ParticipantResultRow[],
    (buyins ?? []) as BuyInResultRow[],
  )
}
```

- [ ] **Step 4：扩展玩家历史查询契约**

在 `PlayerHistorySession` 增加 `started_at: string | null`，在 `PlayerHistoryEntry` 增加：

```ts
final_chips: number | null
total_buyin: number
buy_in_count: number
```

将 session select 扩展为：

```ts
.select('id, date, description, exchange_rate, started_at')
```

同步把 `sessionRows` 的行类型改为：

```ts
{
  id: string
  date: string
  description: string | null
  exchange_rate: number
  started_at: string | null
}
```

组装目标玩家 entry 时只查找一次：

```ts
const mine = all.find(entry => entry.player_id === id)
return {
  session_id: s.id,
  chips: mine?.chips ?? 0,
  final_chips: mine?.final_chips ?? null,
  total_buyin: mine?.total_buyin ?? 0,
  buy_in_count: mine?.buy_in_count ?? 0,
  sessions: { ...s, session_entries: all },
}
```

- [ ] **Step 5：更新现有测试 fixture 以满足新契约**

在 `lib/stats.test.ts` 的每个 `ResultEntry` fixture 补充与 `chips` 一致的 `final_chips`、`total_buyin`、`buy_in_count`；在每个 `PlayerHistoryEntry` 补充同样字段，并为 session 补充 `started_at`。

采用以下一致数据：

```ts
// s1 alice: 6000 - 2000 = +4000
{ player_id: 'alice', chips: 4000, final_chips: 6000, total_buyin: 2000, buy_in_count: 1 }
// s1 bob: 0 - 4000 = -4000
{ player_id: 'bob', chips: -4000, final_chips: 0, total_buyin: 4000, buy_in_count: 2 }
// s2 alice: 0 - 2000 = -2000
{ player_id: 'alice', chips: -2000, final_chips: 0, total_buyin: 2000, buy_in_count: 1 }
// s2 bob: 4000 - 2000 = +2000
{ player_id: 'bob', chips: 2000, final_chips: 4000, total_buyin: 2000, buy_in_count: 1 }
```

- [ ] **Step 6：先运行目标测试，再运行全量测试和类型构建**

Run:

```bash
npm test -- lib/queries.test.ts
npm test
npm run build
```

Expected: 三条命令均退出 0；页面数据类型没有缺失字段错误。

- [ ] **Step 7：提交查询接线**

```bash
git add lib/queries.ts lib/queries.test.ts lib/stats.test.ts
git commit -m "feat: expose player settlement details"
```

### Task 3：用纯统计生成确定性的累计 OHLC

**Files:**
- Modify: `lib/stats.ts:65-110`
- Modify: `lib/stats.test.ts:63-111`

- [ ] **Step 1：准备完整测试类型与 fixture builder**

先把测试文件的类型 import 改为：

```ts
import type {
  LeaderboardSessionRow,
  PlayerDetail,
  PlayerHistoryEntry,
} from './queries'
```

在 `computePlayerHistory` 测试组之前增加完整 fixture builder：

```ts
interface EntryOptions {
  session_id: string
  date?: string
  started_at?: string | null
  chips?: number
  total_buyin?: number
  buy_in_count?: number
  final_chips?: number | null
  exchange_rate?: number
}

function makeEntry({
  session_id,
  date = '2026-02-01',
  started_at = null,
  chips = 0,
  total_buyin = 2000,
  buy_in_count = 1,
  final_chips,
  exchange_rate = 40,
}: EntryOptions): PlayerHistoryEntry {
  const resolvedFinal = final_chips === undefined ? total_buyin + chips : final_chips
  const resultEntry = {
    player_id: 'alice',
    chips,
    final_chips: resolvedFinal,
    total_buyin,
    buy_in_count,
  }
  return {
    session_id,
    chips,
    final_chips: resolvedFinal,
    total_buyin,
    buy_in_count,
    sessions: {
      id: session_id,
      date,
      description: null,
      exchange_rate,
      started_at,
      session_entries: [resultEntry],
    },
  }
}

function makePlayerDetail(entries: PlayerHistoryEntry[]): PlayerDetail {
  return { id: 'alice', name: 'Alice', entries }
}
```

- [ ] **Step 2：增加累计 OHLC 与不变量失败测试**

```ts
it('builds contiguous chips and CNY candles from actual buy-ins', () => {
  const result = computePlayerHistory(detail)
  expect(result.history[0].chips_candle).toEqual({
    open: 0,
    high: 4000,
    low: -2000,
    close: 4000,
  })
  expect(result.history[1].chips_candle).toEqual({
    open: 4000,
    high: 4000,
    low: 2000,
    close: 2000,
  })
  expect(result.history[0].cny_candle).toEqual({
    open: 0,
    high: 100,
    low: -50,
    close: 100,
  })
  expect(result.history[1].cny_candle).toEqual({
    open: 100,
    high: 100,
    low: 50,
    close: 50,
  })
  expect(result.history[0].chips_candle.close)
    .toBe(result.history[1].chips_candle.open)
  for (const point of result.history) {
    expect(point.chips_candle.low)
      .toBeLessThanOrEqual(Math.min(point.chips_candle.open, point.chips_candle.close))
    expect(point.chips_candle.high)
      .toBeGreaterThanOrEqual(Math.max(point.chips_candle.open, point.chips_candle.close))
  }
})
```

- [ ] **Step 3：增加同日确定性排序失败测试**

```ts

it('orders same-day sessions by valid start time, then session id, with missing times last', () => {
  const sameDay = makePlayerDetail([
    makeEntry({ session_id: 'null-b', date: '2026-02-01', started_at: null }),
    makeEntry({ session_id: 'late', date: '2026-02-01', started_at: '2026-02-01T20:00:00+08:00' }),
    makeEntry({ session_id: 'early', date: '2026-02-01', started_at: '2026-02-01T10:00:00+08:00' }),
    makeEntry({ session_id: 'same-b', date: '2026-02-01', started_at: '2026-02-01T12:00:00+08:00' }),
    makeEntry({ session_id: 'same-a', date: '2026-02-01', started_at: '2026-02-01T12:00:00+08:00' }),
    makeEntry({ session_id: 'null-a', date: '2026-02-01', started_at: 'invalid' }),
  ])
  expect(computePlayerHistory(sameDay).history.map(point => point.session_id))
    .toEqual(['early', 'same-a', 'same-b', 'late', 'null-a', 'null-b'])
})

it('sorts all missing same-day start times by session id', () => {
  const missing = makePlayerDetail([
    makeEntry({ session_id: 'b', started_at: null }),
    makeEntry({ session_id: 'a', started_at: null }),
  ])
  expect(computePlayerHistory(missing).history.map(point => point.session_id))
    .toEqual(['a', 'b'])
})
```

- [ ] **Step 4：增加非标准买入、CNY 舍入与持平失败测试**

```ts

it('uses actual non-standard buy-ins and preserves tiny CNY doji direction data', () => {
  const custom = makePlayerDetail([
    makeEntry({
      session_id: 'custom-buyin',
      chips: 500,
      total_buyin: 4500,
      buy_in_count: 3,
      final_chips: 5000,
      exchange_rate: 40,
    }),
    makeEntry({
      session_id: 'tiny-win',
      date: '2026-02-02',
      chips: 1,
      total_buyin: 2000,
      final_chips: 2001,
      exchange_rate: 1000,
    }),
  ])
  const history = computePlayerHistory(custom).history
  expect(history[0].chips_candle.low).toBe(-4500)
  expect(history[0].cny_candle.low).toBe(-112.5)
  expect(history[1].chips).toBe(1)
  expect(history[1].cny).toBe(0)
  expect(history[1].cny_candle.open).toBe(history[1].cny_candle.close)
})

it('builds a neutral doji for a true tie at a different exchange rate', () => {
  const tie = computePlayerHistory(makePlayerDetail([
    makeEntry({
      session_id: 'tie',
      chips: 0,
      total_buyin: 2000,
      final_chips: 2000,
      exchange_rate: 20,
    }),
  ])).history[0]
  expect(tie.chips_candle).toEqual({ open: 0, high: 0, low: -2000, close: 0 })
  expect(tie.cny_candle).toEqual({ open: 0, high: 0, low: -100, close: 0 })
})
```

- [ ] **Step 5：运行统计测试并确认失败**

Run: `npm test -- lib/stats.test.ts`

Expected: FAIL，缺少 `chips_candle`/`cny_candle` 或同日顺序不符合预期。

- [ ] **Step 6：实现 CandlePoint 与确定性比较器**

在 `lib/stats.ts` 把类型 import 扩展为 `PlayerHistoryEntry`，并增加：

```ts
import type {
  LeaderboardSessionRow,
  PlayerDetail,
  PlayerHistoryEntry,
} from '@/lib/queries'

export interface CandlePoint {
  open: number
  high: number
  low: number
  close: number
}

function timestamp(value: string | null): number | null {
  if (value === null) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function compareHistoryEntries(a: PlayerHistoryEntry, b: PlayerHistoryEntry): number {
  const dateOrder = a.sessions.date.localeCompare(b.sessions.date)
  if (dateOrder !== 0) return dateOrder
  const aTime = timestamp(a.sessions.started_at)
  const bTime = timestamp(b.sessions.started_at)
  if (aTime !== null && bTime === null) return -1
  if (aTime === null && bTime !== null) return 1
  if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime
  return a.session_id.localeCompare(b.session_id)
}

function createCandle(open: number, net: number, buyIn: number): CandlePoint {
  const close = open + net
  return {
    open,
    high: Math.max(open, close),
    low: open - buyIn,
    close,
  }
}
```

- [ ] **Step 7：在单次遍历中生成两套 CandlePoint**

扩展 `HistoryPoint` 的账本字段和 `chips_candle`/`cny_candle`。先把原有排序明确替换为：

```ts
const sorted = [...detail.entries].sort(compareHistoryEntries)
```

随后让 `computePlayerHistory` 的 map 主体使用以下顺序：

```ts
const chipsCandle = createCandle(cumulative, e.chips, e.total_buyin)
const cny = toCny(e.chips, e.sessions.exchange_rate)
const buyInCny = toCny(e.total_buyin, e.sessions.exchange_rate)
const cnyCandle = createCandle(cumulativeCny, cny, buyInCny)

cumulative = chipsCandle.close
cumulativeCny = cnyCandle.close

return {
  date: e.sessions.date,
  session_id: e.session_id,
  chips: e.chips,
  cumulative,
  cny,
  cumulative_cny: cumulativeCny,
  description: e.sessions.description,
  buy_in_count: e.buy_in_count,
  total_buyin: e.total_buyin,
  final_chips: e.final_chips,
  chips_candle: chipsCandle,
  cny_candle: cnyCandle,
}
```

- [ ] **Step 8：运行目标测试与全量回归**

Run:

```bash
npm test -- lib/stats.test.ts
npm test
npm run build
```

Expected: 全部退出 0；既有 totals、wins、POG 测试继续通过。

- [ ] **Step 9：提交累计 OHLC**

```bash
git add lib/stats.ts lib/stats.test.ts
git commit -m "feat: compute player candlestick history"
```

## Chunk 2：蜡烛几何与图表系列

### Task 4：用纯函数固定蜡烛方向和像素投影

**Files:**
- Create: `lib/candle-geometry.ts`
- Create: `lib/candle-geometry.test.ts`
- Reference: `lib/stats.ts` 中的 `CandlePoint`

- [ ] **Step 1：写方向和几何投影失败测试**

创建 `lib/candle-geometry.test.ts`：

```ts
import { describe, expect, it } from 'vitest'
import {
  candleDirection,
  isActivationKey,
  projectCandleGeometry,
} from './candle-geometry'

describe('candleDirection', () => {
  it('uses raw chips to classify wins, losses, and ties', () => {
    expect(candleDirection(1)).toBe('up')
    expect(candleDirection(-1)).toBe('down')
    expect(candleDirection(0)).toBe('flat')
  })
})

describe('isActivationKey', () => {
  it('accepts Enter and Space only', () => {
    expect(isActivationKey('Enter')).toBe(true)
    expect(isActivationKey(' ')).toBe(true)
    expect(isActivationKey('ArrowRight')).toBe(false)
  })
})

describe('projectCandleGeometry', () => {
  it('projects a rising candle inside the Recharts range bounds', () => {
    const geometry = projectCandleGeometry(
      { x: 10, y: 20, width: 20, height: 100 },
      { low: 0, high: 100, open: 25, close: 75 },
    )
    expect(geometry).toMatchObject({
      centerX: 20,
      wickTop: 20,
      wickBottom: 120,
      openY: 95,
      closeY: 45,
      bodyLeft: 14.5,
      bodyWidth: 11,
      isDoji: false,
    })
  })

  it('projects a falling candle without reversing its body', () => {
    const geometry = projectCandleGeometry(
      { x: 10, y: 20, width: 20, height: 100 },
      { low: 0, high: 100, open: 75, close: 25 },
    )
    expect(geometry).toMatchObject({ openY: 45, closeY: 95, isDoji: false })
  })

  it('projects a doji inside a non-zero low/high range', () => {
    const geometry = projectCandleGeometry(
      { x: 10, y: 20, width: 20, height: 100 },
      { low: 0, high: 100, open: 50, close: 50 },
    )
    expect(geometry).toMatchObject({ openY: 70, closeY: 70, isDoji: true })
  })

  it('preserves finite coordinates for a sub-pixel vertical range', () => {
    const geometry = projectCandleGeometry(
      { x: 10, y: 20, width: 20, height: 0.2 },
      { low: 0, high: 100, open: 25, close: 75 },
    )
    expect(geometry?.wickBottom).toBeCloseTo(20.2)
    expect(Number.isFinite(geometry?.openY ?? Number.NaN)).toBe(true)
    expect(Number.isFinite(geometry?.closeY ?? Number.NaN)).toBe(true)
  })

  it('returns a stable doji for an all-zero range', () => {
    const geometry = projectCandleGeometry(
      { x: 10, y: 50, width: 20, height: 0 },
      { low: 0, high: 0, open: 0, close: 0 },
    )
    expect(geometry).toMatchObject({
      wickTop: 50,
      wickBottom: 50,
      openY: 50,
      closeY: 50,
      isDoji: true,
    })
    expect(geometry?.hitHeight).toBe(24)
  })

  it('keeps body and hit targets inside an extremely narrow category', () => {
    const geometry = projectCandleGeometry(
      { x: 10, y: 20, width: 0.4, height: 100 },
      { low: 0, high: 100, open: 25, close: 75 },
    )
    expect(geometry?.bodyWidth).toBeLessThanOrEqual(0.4)
    expect(geometry?.hitWidth).toBeLessThanOrEqual(0.4)
  })

  it('rejects non-finite or invalid OHLC values', () => {
    expect(projectCandleGeometry(
      { x: 0, y: 0, width: 10, height: 10 },
      { low: 5, high: 4, open: 5, close: 4 },
    )).toBeNull()
    expect(projectCandleGeometry(
      { x: 0, y: 0, width: 10, height: 10 },
      { low: 0, high: Number.NaN, open: 0, close: 0 },
    )).toBeNull()
  })
})
```

- [ ] **Step 2：运行目标测试并确认失败**

Run: `npm test -- lib/candle-geometry.test.ts`

Expected: FAIL，无法解析 `./candle-geometry`。

- [ ] **Step 3：实现方向、键盘和几何纯函数**

创建 `lib/candle-geometry.ts`：

```ts
import type { CandlePoint } from './stats'

export type CandleDirection = 'up' | 'down' | 'flat'

export interface CandleBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface CandleGeometry {
  centerX: number
  wickTop: number
  wickBottom: number
  openY: number
  closeY: number
  bodyLeft: number
  bodyWidth: number
  hitX: number
  hitY: number
  hitWidth: number
  hitHeight: number
  isDoji: boolean
}

export function candleDirection(netChips: number): CandleDirection {
  if (netChips > 0) return 'up'
  if (netChips < 0) return 'down'
  return 'flat'
}

export function isActivationKey(key: string): boolean {
  return key === 'Enter' || key === ' '
}

function allFinite(values: number[]): boolean {
  return values.every(Number.isFinite)
}

export function projectCandleGeometry(
  bounds: CandleBounds,
  candle: CandlePoint,
): CandleGeometry | null {
  const values = [
    bounds.x,
    bounds.y,
    bounds.width,
    bounds.height,
    candle.low,
    candle.high,
    candle.open,
    candle.close,
  ]
  if (!allFinite(values) || bounds.width <= 0 || bounds.height < 0) return null
  if (candle.low > Math.min(candle.open, candle.close)) return null
  if (candle.high < Math.max(candle.open, candle.close)) return null

  const yOf = (value: number) => candle.high === candle.low
    ? bounds.y
    : bounds.y + ((candle.high - value) / (candle.high - candle.low)) * bounds.height
  const bodyWidth = Math.min(bounds.width, Math.max(0.5, bounds.width * 0.55))
  const hitWidth = Math.min(bounds.width, Math.max(bodyWidth, 16))
  const hitHeight = Math.max(bounds.height, 24)
  const centerX = bounds.x + bounds.width / 2

  return {
    centerX,
    wickTop: bounds.y,
    wickBottom: bounds.y + bounds.height,
    openY: yOf(candle.open),
    closeY: yOf(candle.close),
    bodyLeft: centerX - bodyWidth / 2,
    bodyWidth,
    hitX: centerX - hitWidth / 2,
    hitY: bounds.y - (hitHeight - bounds.height) / 2,
    hitWidth,
    hitHeight,
    isDoji: candle.open === candle.close,
  }
}
```

- [ ] **Step 4：运行目标测试和全量测试**

Run:

```bash
npm test -- lib/candle-geometry.test.ts
npm test
```

Expected: 两条命令均退出 0。

- [ ] **Step 5：提交几何模块**

```bash
git add lib/candle-geometry.ts lib/candle-geometry.test.ts
git commit -m "feat: add candlestick geometry helpers"
```

### Task 5：实现可交互的 SVG CandleShape

**Files:**
- Create: `components/PlayerCandleShape.tsx`
- Create: `lib/player-candle-shape.test.ts`
- Reference: `lib/candle-geometry.ts`
- Reference: `lib/stats.ts` 中的 `HistoryPoint`

- [ ] **Step 1：写 CandleShape 静态渲染失败测试**

现有 Vitest 只收集 `lib/**/*.test.ts`，因此创建 `lib/player-candle-shape.test.ts`，用 `react-dom/server` 验证无需 DOM 的渲染契约：

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import PlayerCandleShape from '@/components/PlayerCandleShape'
import type { HistoryPoint } from './stats'

const payload: HistoryPoint = {
  date: '2026-07-25',
  session_id: 's1',
  chips: 1500,
  cumulative: 4500,
  cny: 37.5,
  cumulative_cny: 112.5,
  description: null,
  buy_in_count: 3,
  total_buyin: 6000,
  final_chips: 7500,
  chips_candle: { open: 3000, high: 4500, low: -3000, close: 4500 },
  cny_candle: { open: 75, high: 112.5, low: -75, close: 112.5 },
}

const baseProps = {
  x: 10,
  y: 20,
  width: 20,
  height: 100,
  index: 0,
  isActive: false,
  payload,
  mode: 'chips' as const,
  showBest: true,
  showWorst: false,
  onActivate: vi.fn(),
}

describe('PlayerCandleShape', () => {
  it('renders an accessible green candle and BEST label', () => {
    const html = renderToStaticMarkup(
      createElement(PlayerCandleShape, baseProps as never),
    )
    expect(html).toContain('role="button"')
    expect(html).toContain('tabindex="0"')
    expect(html).toContain('aria-label="2026-07-25 session"')
    expect(html).toContain('#00ff88')
    expect(html).toContain('BEST')
    expect(html).not.toContain('WORST')
  })

  it('renders nothing when Recharts payload is missing', () => {
    const html = renderToStaticMarkup(
      createElement(PlayerCandleShape, { ...baseProps, payload: undefined } as never),
    )
    expect(html).toBe('')
  })
})
```

- [ ] **Step 2：运行静态渲染测试并确认失败**

Run: `npm test -- lib/player-candle-shape.test.ts`

Expected: FAIL，无法解析 `@/components/PlayerCandleShape`。

- [ ] **Step 3：创建只依赖已测试纯函数的 CandleShape**

创建 `components/PlayerCandleShape.tsx`。目标结构如下；如果 Recharts 3.8.1 的 `BarShapeProps` 将某个数值声明为 union，只在 `Number(...)` 入口处做最小收窄：

```tsx
import type { KeyboardEvent } from 'react'
import type { BarShapeProps } from 'recharts'
import {
  candleDirection,
  isActivationKey,
  projectCandleGeometry,
} from '@/lib/candle-geometry'
import type { HistoryPoint } from '@/lib/stats'

type Mode = 'chips' | 'cny'

interface PlayerCandleShapeProps extends BarShapeProps {
  mode: Mode
  showBest: boolean
  showWorst: boolean
  onActivate: (sessionId: string) => void
}

const COLORS = {
  up: '#00ff88',
  down: '#ff4444',
  flat: '#888888',
} as const

export default function PlayerCandleShape(props: PlayerCandleShapeProps) {
  const payload = props.payload as HistoryPoint | undefined
  if (!payload) return null
  const candle = props.mode === 'cny' ? payload.cny_candle : payload.chips_candle
  const geometry = projectCandleGeometry({
    x: Number(props.x),
    y: Number(props.y),
    width: Number(props.width),
    height: Number(props.height),
  }, candle)
  if (!geometry) return null

  const direction = candleDirection(payload.chips)
  const color = COLORS[direction]
  const bodyTop = Math.min(geometry.openY, geometry.closeY)
  const bodyHeight = Math.max(1, Math.abs(geometry.openY - geometry.closeY))
  const activate = () => props.onActivate(payload.session_id)
  const onKeyDown = (event: KeyboardEvent<SVGGElement>) => {
    if (!isActivationKey(event.key)) return
    event.preventDefault()
    activate()
  }

  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={`${payload.date} session`}
      onClick={activate}
      onKeyDown={onKeyDown}
      style={{ cursor: 'pointer' }}
    >
      <rect
        x={geometry.hitX}
        y={geometry.hitY}
        width={geometry.hitWidth}
        height={geometry.hitHeight}
        fill="transparent"
        pointerEvents="all"
      />
      <line
        x1={geometry.centerX}
        x2={geometry.centerX}
        y1={geometry.wickTop}
        y2={geometry.wickBottom}
        stroke={color}
        strokeWidth={props.isActive ? 2 : 1.5}
      />
      {geometry.isDoji ? (
        <line
          x1={geometry.bodyLeft}
          x2={geometry.bodyLeft + geometry.bodyWidth}
          y1={geometry.openY}
          y2={geometry.openY}
          stroke={color}
          strokeWidth={2}
        />
      ) : (
        <rect
          x={geometry.bodyLeft}
          y={bodyTop}
          width={geometry.bodyWidth}
          height={bodyHeight}
          fill={color}
          fillOpacity={0.22}
          stroke={color}
          strokeWidth={1.5}
        />
      )}
      {props.showBest && (
        <text
          x={geometry.centerX}
          y={bodyTop - 10}
          textAnchor="middle"
          fill="#00ff88"
          fontSize={9}
          fontFamily="JetBrains Mono"
        >
          BEST
        </text>
      )}
      {props.showWorst && (
        <text
          x={geometry.centerX}
          y={bodyTop + bodyHeight + 14}
          textAnchor="middle"
          fill="#ff4444"
          fontSize={9}
          fontFamily="JetBrains Mono"
        >
          WORST
        </text>
      )}
    </g>
  )
}
```

- [ ] **Step 4：运行静态渲染、纯函数回归和 TypeScript 构建**

Run:

```bash
npm test -- lib/player-candle-shape.test.ts
npm test -- lib/candle-geometry.test.ts
npm run build
```

Expected: 三条命令均退出 0；新组件不存在 Recharts props 或 SVG 事件类型错误。

- [ ] **Step 5：提交 CandleShape**

```bash
git add components/PlayerCandleShape.tsx lib/player-candle-shape.test.ts
git commit -m "feat: add interactive player candle shape"
```

### Task 6：在 PlayerChart 中接入 Candle 系列

**Files:**
- Modify: `components/PlayerChart.tsx:1-114`
- Create: `lib/player-chart.test.ts`
- Reference: `components/PlayerCandleShape.tsx`

- [ ] **Step 1：写 Line/Candle 分支和 Recharts props 失败测试**

创建 `lib/player-chart.test.ts`；用轻量 mock 捕获 Recharts props，避免依赖 DOM 尺寸：

```ts
import { createElement, isValidElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HistoryPoint } from './stats'

const mocks = vi.hoisted(() => ({
  bar: vi.fn((_props: any) => null),
  line: vi.fn((_props: any) => null),
  xAxis: vi.fn((_props: any) => null),
  push: vi.fn(),
}))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('recharts', () => {
  const passthrough = ({ children }: { children?: any }) => children ?? null
  return {
    Bar: mocks.bar,
    ComposedChart: passthrough,
    Line: mocks.line,
    LineChart: passthrough,
    ReferenceLine: () => null,
    ResponsiveContainer: passthrough,
    Tooltip: () => null,
    XAxis: mocks.xAxis,
    YAxis: () => null,
  }
})

import PlayerChart from '@/components/PlayerChart'

const point: HistoryPoint = {
  date: '2026-07-25',
  session_id: 's1',
  chips: 1500,
  cumulative: 4500,
  cny: 37.5,
  cumulative_cny: 112.5,
  description: null,
  buy_in_count: 3,
  total_buyin: 6000,
  final_chips: 7500,
  chips_candle: { open: 3000, high: 4500, low: -3000, close: 4500 },
  cny_candle: { open: 75, high: 112.5, low: -75, close: 112.5 },
}

function render(chartType: 'line' | 'candle' = 'line') {
  return renderToStaticMarkup(createElement(PlayerChart, {
    data: [point],
    positive: true,
    mode: 'chips',
    chartType,
  }))
}

describe('PlayerChart', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps Line as the default series', () => {
    render()
    expect(mocks.line).toHaveBeenCalledTimes(1)
    expect(mocks.bar).not.toHaveBeenCalled()
  })

  it('passes the selected low/high tuple and stable X axis to Candle', () => {
    render('candle')
    expect(mocks.bar).toHaveBeenCalledTimes(1)
    expect(mocks.line).not.toHaveBeenCalled()
    const barProps = mocks.bar.mock.calls[0][0]
    expect(barProps.dataKey(point)).toEqual([-3000, 4500])
    expect(barProps.isAnimationActive).toBe(false)
    const shape = barProps.shape({ index: 0 } as never)
    expect(isValidElement(shape)).toBe(true)
    if (!isValidElement<{ showBest: boolean; showWorst: boolean }>(shape)) {
      throw new Error('Expected CandleShape React element')
    }
    expect(shape.props.showBest).toBe(false)
    expect(shape.props.showWorst).toBe(false)
    const axisProps = mocks.xAxis.mock.calls[0][0]
    expect(axisProps.dataKey).toBe('session_id')
    expect(axisProps.interval).toBe('preserveStartEnd')
  })
})
```

- [ ] **Step 2：运行组件分支测试并确认失败**

Run: `npm test -- lib/player-chart.test.ts`

Expected: FAIL；Candle 模式仍渲染 Line，Bar 未被调用。

- [ ] **Step 3：将共用容器升级为 ComposedChart**

把 Recharts import 改为包含：

```ts
import {
  Bar,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type BarShapeProps,
} from 'recharts'
```

扩展 props，但暂时给 `chartType` 默认值，保证本块后续页面工具栏接线前调用方仍可构建：

```ts
type ChartType = 'line' | 'candle'

export default function PlayerChart({
  data,
  positive,
  mode,
  chartType = 'line',
}: {
  data: HistoryPoint[]
  positive: boolean
  mode: 'chips' | 'cny'
  chartType?: ChartType
}) {
```

将 `<LineChart>`/`</LineChart>` 替换为带标签余量的：

```tsx
<ComposedChart data={data} margin={{ top: 18, right: 8, bottom: 12, left: 0 }}>
  {/* shared axes, ReferenceLine, Tooltip, and conditional series */}
</ComposedChart>
```

- [ ] **Step 4：建立唯一 X 轴和无冲突 extrema 规则**

增加日期 Map 和公共开关：

```ts
const dateBySessionId = useMemo(
  () => new Map(data.map(point => [point.session_id, point.date])),
  [data],
)
const showExtrema = data.length > 1 && bestIdx !== worstIdx
```

把 XAxis 改为：

```tsx
<XAxis
  dataKey="session_id"
  tickFormatter={sessionId => dateBySessionId.get(String(sessionId)) ?? ''}
  tick={{ fill: '#666666', fontSize: 10, fontFamily: 'JetBrains Mono' }}
  axisLine={false}
  tickLine={false}
  interval="preserveStartEnd"
/>
```

现有 `CustomDot` 的 `isBest`/`isWorst` 必须同时检查 `showExtrema`，确保单场或所有结果相同时 Line 视图也不重叠。

- [ ] **Step 5：增加模式相关区间 dataKey 与 CandleShape renderer**

```tsx
const candleRange = useCallback((point: HistoryPoint): [number, number] => {
  const candle = mode === 'cny' ? point.cny_candle : point.chips_candle
  return [candle.low, candle.high]
}, [mode])

const activateSession = useCallback(
  (sessionId: string) => router.push(`/sessions/${sessionId}`),
  [router],
)

const renderCandle = useCallback((props: BarShapeProps) => (
  <PlayerCandleShape
    {...props}
    mode={mode}
    showBest={showExtrema && props.index === bestIdx}
    showWorst={showExtrema && props.index === worstIdx}
    onActivate={activateSession}
  />
), [activateSession, bestIdx, mode, showExtrema, worstIdx])
```

在图表末尾条件渲染：

```tsx
{chartType === 'line' ? (
  <Line
    type="linear"
    dataKey={dataKey}
    stroke={color}
    strokeWidth={1.5}
    dot={CustomDot}
    activeDot={CustomActiveDot}
  />
) : (
  <Bar
    dataKey={candleRange}
    shape={renderCandle}
    activeBar={false}
    isAnimationActive={false}
  />
)}
```

- [ ] **Step 6：扩展共用 Tooltip 为账本事实**

保留日期、单场、累计和 description；在日期后新增：

```tsx
<div style={{ color: '#666666' }}>
  buy-ins: {p.buy_in_count}× · {p.total_buyin.toLocaleString()} chips
</div>
<div style={{ color: '#666666' }}>
  final: {p.final_chips === null ? '—' : `${p.final_chips.toLocaleString()} chips`}
</div>
```

session 颜色按 `p.chips` 判定：正数绿色、负数红色、0 为 `#888888`。金额本身继续用现有 `fmtVal` 按当前 mode 格式化，合成 high 不进入 Tooltip。

- [ ] **Step 7：运行组件测试、完整测试和构建**

Run:

```bash
npm test -- lib/player-chart.test.ts
npm test
npm run build
```

Expected: 三条命令均退出 0；默认未传 `chartType` 时仍构建为现有 Line 视图。

此时 Candle 系列尚未从页面工具栏暴露；不得把构建成功当作浏览器验收。必须完成 Chunk 3 Task 8 的真实 Recharts 验证后，才能结束本功能。

- [ ] **Step 8：提交图表系列接入**

```bash
git add components/PlayerChart.tsx lib/player-chart.test.ts
git commit -m "feat: add player candlestick chart series"
```

### Task 7：接通页面分段控件

**Files:**
- Modify: `components/PlayerStatsChart.tsx:28-70`
- Create: `lib/player-stats-chart.test.ts`
- Reference: `components/PlayerChart.tsx`

- [ ] **Step 1：写默认模式、单场可见和控件语义失败测试**

创建 `lib/player-stats-chart.test.ts`：

```ts
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { HistoryPoint } from './stats'

const mocks = vi.hoisted(() => ({ chart: vi.fn((_props: any) => null) }))
vi.mock('@/components/PlayerChart', () => ({ default: mocks.chart }))
vi.mock('@/components/ChipValue', () => ({ default: () => null }))
vi.mock('@/components/PlayerNameEditor', () => ({ default: () => null }))

import PlayerStatsChart from '@/components/PlayerStatsChart'

const point: HistoryPoint = {
  date: '2026-07-25',
  session_id: 's1',
  chips: 0,
  cumulative: 0,
  cny: 0,
  cumulative_cny: 0,
  description: null,
  buy_in_count: 0,
  total_buyin: 0,
  final_chips: 0,
  chips_candle: { open: 0, high: 0, low: 0, close: 0 },
  cny_candle: { open: 0, high: 0, low: 0, close: 0 },
}

describe('PlayerStatsChart', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders one session with LINE + CNY defaults and accessible mode groups', () => {
    const html = renderToStaticMarkup(createElement(PlayerStatsChart, {
      id: 'alice',
      initialName: 'Alice',
      data: [point],
      totalCny: 0,
      totalChips: 0,
      sessions: 1,
      wins: 0,
      pogCount: 0,
    }))

    expect(mocks.chart.mock.calls[0][0]).toEqual(expect.objectContaining({
      mode: 'cny',
      chartType: 'line',
      data: [point],
    }))
    expect(html).toContain('aria-label="Chart type"')
    expect(html).toContain('aria-label="Value unit"')
    expect(html).toContain('LINE')
    expect(html).toContain('CANDLE')
    expect(html).toContain('aria-pressed="true"')
  })
})
```

- [ ] **Step 2：运行页面状态测试并确认失败**

Run: `npm test -- lib/player-stats-chart.test.ts`

Expected: FAIL；单条数据不渲染 PlayerChart，且没有 Chart type 控件。

- [ ] **Step 3：增加独立 chartType 状态和稳定分段控件**

在 `mode` 状态后增加：

```ts
const [chartType, setChartType] = useState<'line' | 'candle'>('line')
```

将图表渲染条件从 `data.length > 1` 改为 `data.length > 0`。用以下结构替换现有单组 CNY/CHIPS 按钮；保留动态标题：

```tsx
<div className="flex flex-wrap items-center justify-between gap-3 mb-4 mx-2">
  <p className="text-xs text-muted tracking-widest">
    {mode === 'cny' ? 'CUMULATIVE CNY' : 'CUMULATIVE CHIPS'}
  </p>
  <div className="flex flex-wrap items-center gap-4">
    <div role="group" aria-label="Chart type" className="inline-flex border border-border">
      {(['line', 'candle'] as const).map(value => (
        <button
          key={value}
          type="button"
          aria-pressed={chartType === value}
          onClick={() => setChartType(value)}
          className={`h-7 min-w-16 px-2 text-xs tracking-widest transition-colors ${
            chartType === value
              ? 'bg-surface text-white border-b-2 border-accent'
              : 'text-muted hover:text-white'
          }`}
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
    <div role="group" aria-label="Value unit" className="inline-flex border border-border">
      {(['cny', 'chips'] as const).map(value => (
        <button
          key={value}
          type="button"
          aria-pressed={mode === value}
          onClick={() => setMode(value)}
          className={`h-7 min-w-16 px-2 text-xs tracking-widest transition-colors ${
            mode === value
              ? 'bg-surface text-white border-b-2 border-accent'
              : 'text-muted hover:text-white'
          }`}
        >
          {value.toUpperCase()}
        </button>
      ))}
    </div>
  </div>
</div>
```

向图表传入新状态：

```tsx
<PlayerChart
  data={data}
  positive={positive}
  mode={mode}
  chartType={chartType}
/>
```

- [ ] **Step 4：运行页面状态测试、全量测试和生产构建**

Run:

```bash
npm test -- lib/player-stats-chart.test.ts
npm test
npm run build
```

Expected: 三条命令均退出 0；单条数据的页面不再被条件隐藏。

组件测试只验证页面接线；真实 Recharts 与响应式验收必须完成 Chunk 3 Task 8 后才算结束。

- [ ] **Step 5：提交页面工具栏**

```bash
git add components/PlayerStatsChart.tsx lib/player-stats-chart.test.ts
git commit -m "feat: add player chart view controls"
```

## Chunk 3：可控浏览器验收与最终回归

### Task 8：用临时预览路由覆盖真实 Recharts 边界

**Files:**
- Temporarily create, then delete: `app/candlestick-preview/page.tsx`
- Verify: `components/PlayerStatsChart.tsx`
- Verify: `components/PlayerChart.tsx`
- Verify: `components/PlayerCandleShape.tsx`

该路由只用于本地验收，必须在本任务结束前删除，绝不暂存或提交。

- [ ] **Step 1：创建包含 1/2/41 场的可控预览数据**

用 `apply_patch` 临时创建 `app/candlestick-preview/page.tsx`：

```tsx
'use client'

import PlayerStatsChart from '@/components/PlayerStatsChart'
import PlayerSessionHistoryTable from '@/components/PlayerSessionHistoryTable'
import { computePlayerHistory } from '@/lib/stats'
import type { PlayerDetail, PlayerHistoryEntry } from '@/lib/queries'

function entry(index: number, chips: number, totalBuyin: number, date: string): PlayerHistoryEntry {
  const sessionId = `preview-${index}`
  const result = {
    player_id: 'preview',
    chips,
    final_chips: totalBuyin + chips,
    total_buyin: totalBuyin,
    buy_in_count: totalBuyin === 0 ? 0 : Math.max(1, Math.ceil(totalBuyin / 2000)),
  }
  return {
    session_id: sessionId,
    chips,
    final_chips: result.final_chips,
    total_buyin: totalBuyin,
    buy_in_count: result.buy_in_count,
    sessions: {
      id: sessionId,
      date,
      description: `preview session ${index}`,
      exchange_rate: 40,
      started_at: `2026-07-01T${String(index % 24).padStart(2, '0')}:00:00Z`,
      session_entries: [result],
    },
  }
}

function history(entries: PlayerHistoryEntry[]) {
  const detail: PlayerDetail = { id: 'preview', name: 'Preview', entries }
  return computePlayerHistory(detail).history
}

const one = history([entry(0, 0, 0, '2026-07-01')])
const equalSameDay = history([
  entry(1, 100, 2000, '2026-07-02'),
  entry(2, 100, 2000, '2026-07-02'),
])
const dense = history(Array.from({ length: 41 }, (_, index) => entry(
  index + 10,
  index % 5 === 0 ? -500 : 200 + index * 10,
  2000 + (index % 3) * 500,
  `2026-07-${String((index % 28) + 1).padStart(2, '0')}`,
)))

function Scenario({ name, data }: { name: string; data: ReturnType<typeof history> }) {
  const last = data[data.length - 1]
  return (
    <section className="mb-16">
      <p className="mb-4 text-xs text-muted tracking-widest">{name}</p>
      <PlayerStatsChart
        id={`preview-${name}`}
        initialName={name}
        data={data}
        totalCny={last?.cumulative_cny ?? 0}
        totalChips={last?.cumulative ?? 0}
        sessions={data.length}
        wins={data.filter(point => point.chips > 0).length}
        pogCount={0}
      />
      <p className="mb-4 text-xs text-muted tracking-widest">SESSION HISTORY</p>
      <PlayerSessionHistoryTable rows={[...data].reverse()} />
    </section>
  )
}

export default function CandlestickPreviewPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <Scenario name="ONE ZERO RANGE" data={one} />
      <Scenario name="TWO EQUAL SAME DAY" data={equalSameDay} />
      <Scenario name="FORTY ONE DENSE" data={dense} />
    </main>
  )
}
```

- [ ] **Step 2：确认临时预览本身可构建**

Run: `npm run build`

Expected: 退出 0，路由列表包含 `/candlestick-preview`。

- [ ] **Step 3：启动开发服务器并打开预览路由**

Run: `npm run dev`

Expected: Next.js 输出本地 URL。登录后打开同一端口的 `/candlestick-preview`，三组场景均非空白。

- [ ] **Step 4：验证单场全零 range**

在 `ONE ZERO RANGE` 切换到 CANDLE：

- `[0, 0]` range 实际调用 custom shape，并显示灰色水平 doji。
- Y 轴、零线和日期存在，无 `NaN`/非法 SVG 控制台错误。
- 不显示重叠的 BEST/WORST。

Expected: 三项全部通过。

- [ ] **Step 5：验证分段控件语义和键盘切换**

在任一场景中检查：

- 初始 LINE 与 CNY 按钮分别具有 `aria-pressed="true"`。
- 用 Tab 依次聚焦 LINE、CANDLE、CNY、CHIPS，焦点顺序和可见焦点样式正确。
- 在 CANDLE 上按 Enter、在 CHIPS 上按 Space，选中状态和 `aria-pressed` 随即更新，布局宽度不跳动。

Expected: 两组原生按钮的鼠标和键盘行为一致。

- [ ] **Step 6：验证同日两场、extrema 冲突和蜡烛命中路径**

在 `TWO EQUAL SAME DAY` 切换到 CANDLE：

- 同一日期的两根蜡烛都存在，Tooltip 分别对应唯一 session_id。
- 两场净结果相同，不显示 BEST/WORST。
- 先用鼠标点击第一根蜡烛，再在移动设备模拟下轻触第二根蜡烛；URL 分别进入对应 preview session。
- 返回后以 Tab 聚焦蜡烛，Enter 和 Space 分别验证同一跳转。

Expected: 四项全部通过；预览 session 进入 404 是允许的，URL 中 session_id 必须正确。

- [ ] **Step 7：逐项验证四种模式**

在 `FORTY ONE DENSE` 分别检查并记录：

1. `LINE + CNY`：默认折线、累计值和首尾日期正常。
2. `LINE + CHIPS`：Y 轴和 Tooltip 切换为筹码。
3. `CANDLE + CNY`：range domain 包含 low，颜色按原始筹码方向。
4. `CANDLE + CHIPS`：Tooltip 的 buy-ins、final、session、cumulative 和 description 完整。

Expected: 四个组合均无布局跳动、空白系列或合成 high 文案。

- [ ] **Step 8：完成桌面截图验收**

使用 1440×900 视口，在 CANDLE + CNY 下将截图保存为 `/tmp/chipindex-candlestick-desktop.png`。检查工具栏、图表、Tooltip、下方 SESSION HISTORY 表格、BEST/WORST 和后续场景标题没有重叠；首尾日期可见；41 根蜡烛实体不越过各自 category。

Expected: 截图清晰、非空白，控制台无 hydration/Recharts 错误。

- [ ] **Step 9：完成移动端截图验收**

使用 390×844 视口，在 CANDLE + CHIPS 下将截图保存为 `/tmp/chipindex-candlestick-mobile.png`。检查两组分段控件换行后不溢出，文字不截断，图表无横向滚动，Tooltip 可读且蜡烛可轻触；图表、Tooltip 与下方 SESSION HISTORY 表格不互相遮挡。

Expected: 截图清晰、非空白，无控件或历史内容互相遮挡。

- [ ] **Step 10：删除全部临时验收资产并停止开发服务器**

用 `apply_patch` 删除 `app/candlestick-preview/page.tsx`，删除两个明确的 `/tmp` 截图，然后停止 dev server。

Run:

```bash
rm -f /tmp/chipindex-candlestick-desktop.png
rm -f /tmp/chipindex-candlestick-mobile.png
test ! -e /tmp/chipindex-candlestick-desktop.png
test ! -e /tmp/chipindex-candlestick-mobile.png
git status --short
```

Expected: 两条 `test` 命令和 `git status` 退出 0；不再出现预览路由，仓库内没有截图或预览文件。

### Task 9：执行最终回归并确认提交边界

**Files:**
- Verify only: all files listed in this plan

- [ ] **Step 1：运行完整自动化回归**

Run:

```bash
npm test
npm run build
```

Expected: 两条命令均退出 0。

- [ ] **Step 2：仅在 Task 8 发现缺陷时先写回归测试**

在与缺陷最近的现有测试文件中增加一个最小回归用例：账务/聚合用对应 `lib/*.test.ts`，组件分支用 `lib/player-chart.test.ts` 或 `lib/player-stats-chart.test.ts`，几何用 `lib/candle-geometry.test.ts`。没有缺陷时将 Steps 2-6 标记为不适用，不创建无意义改动。

- [ ] **Step 3：仅在有缺陷时运行功能测试集合并确认红灯**

Run:

```bash
npm test -- lib/session-results.test.ts lib/queries.test.ts lib/stats.test.ts lib/candle-geometry.test.ts lib/player-candle-shape.test.ts lib/player-chart.test.ts lib/player-stats-chart.test.ts
```

Expected: FAIL，失败断言精确对应 Task 8 观察到的问题，而不是类型或 fixture 错误。

- [ ] **Step 4：仅在有红灯时实现最小修复**

只修改触发失败的最小生产文件；不得借机重构已通过验收的账务、查询或图表模块。

- [ ] **Step 5：仅在有修复时运行目标测试和全量回归**

Run:

```bash
npm test -- lib/session-results.test.ts lib/queries.test.ts lib/stats.test.ts lib/candle-geometry.test.ts lib/player-candle-shape.test.ts lib/player-chart.test.ts lib/player-stats-chart.test.ts
npm test
npm run build
```

Expected: 三条命令均退出 0。

- [ ] **Step 6：仅在有修复时暂存明确文件并提交**

暂存命令显式限制为本功能文件；未修改的路径不会产生额外 staged diff：

```bash
git add lib/session-results.ts lib/session-results.test.ts lib/queries.ts lib/queries.test.ts
git add lib/stats.ts lib/stats.test.ts lib/candle-geometry.ts lib/candle-geometry.test.ts
git add lib/player-candle-shape.test.ts lib/player-chart.test.ts lib/player-stats-chart.test.ts
git add components/PlayerCandleShape.tsx components/PlayerChart.tsx components/PlayerStatsChart.tsx
```

Commit:

```bash
git commit -m "fix: address candlestick chart verification"
```

- [ ] **Step 7：在所有可选修复之后做最终状态复核**

Run:

```bash
git status --short
git log -8 --oneline
```

Expected:

- 功能文件均已提交，临时预览路由和两个 `/tmp` 截图不存在。
- `.superpowers/` 可视化草稿即使仍未跟踪，也没有进入暂存区。
- 提交按 session 聚合、查询接线、OHLC、几何、shape、图表系列和工具栏分开；若有验收修复，它位于这些提交之后。
