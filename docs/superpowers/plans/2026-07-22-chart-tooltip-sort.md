# Chart Tooltip 筹码量排序实施计划

> **供执行代理使用：** 必须使用 `superpowers:subagent-driven-development`（可用子代理时）或 `superpowers:executing-plans` 执行本计划，并使用复选框跟踪步骤。

**目标：** chart 模式 hover 某个日期时，玩家详情按该日期的显示值降序排列，同值时按名称升序排列。

**架构：** 在 `lib/chart.ts` 中提供不修改输入的纯排序函数，并由 `LeaderboardChart` 的自定义 content 回调调用。排序后的 payload 继续交给 Recharts 的 `DefaultTooltipContent`，保留当前格式、颜色、筛选和样式行为。

**技术栈：** TypeScript、React 19、Next.js 15、Recharts 3.8.1、Vitest 4。

---

## Chunk 1: 排序规则与 Tooltip 接入

### Task 1: 实现并接入 Tooltip payload 排序

**文件：**

- 新建：`lib/chart.ts`
- 新建：`lib/chart.test.ts`
- 修改：`components/LeaderboardChart.tsx`

- [ ] **步骤 1：先写失败测试**

新建 `lib/chart.test.ts`，导入尚不存在的 `sortTooltipItems`，构造名称顺序与数值顺序不同的 payload，并断言：

```ts
import { describe, expect, it } from 'vitest'
import { sortTooltipItems } from './chart'

describe('sortTooltipItems', () => {
  it('sorts values descending, breaks ties by name, and preserves the input', () => {
    const payload = [
      { name: 'Zulu', value: -100 },
      { name: 'Beta', value: 250 },
      { name: 'Alpha', value: 250 },
      { name: 'Gamma', value: 0 },
    ]

    const sorted = sortTooltipItems(payload)

    expect(sorted.map(item => item.name)).toEqual(['Alpha', 'Beta', 'Gamma', 'Zulu'])
    expect(payload.map(item => item.name)).toEqual(['Zulu', 'Beta', 'Alpha', 'Gamma'])
  })
})
```

- [ ] **步骤 2：运行测试并确认 RED**

运行：`npm test -- lib/chart.test.ts`

预期：测试失败，原因是 `./chart` 或 `sortTooltipItems` 尚不存在，而不是测试语法或环境错误。

- [ ] **步骤 3：编写最小排序实现**

在 `lib/chart.ts` 中定义结构化输入，并返回副本：

```ts
interface TooltipSortItem {
  name?: unknown
  value?: unknown
}

export function sortTooltipItems<T extends TooltipSortItem>(items: readonly T[] | undefined): T[] {
  return [...(items ?? [])].sort((a, b) => {
    const valueDiff = Number(b.value) - Number(a.value)
    if (valueDiff !== 0) return valueDiff
    return String(a.name ?? '').localeCompare(String(b.name ?? ''))
  })
}
```

- [ ] **步骤 4：运行单测并确认 GREEN**

运行：`npm test -- lib/chart.test.ts`

预期：新增测试通过。

- [ ] **步骤 5：先写 Tooltip 接入的失败测试**

在 `lib/chart.test.ts` 中增加组件 import 和独立测试。输入显式携带 `itemSorter: 'name'`，以验证包装组件会覆盖 Recharts 的默认排序：

```ts
import { SortedTooltipContent } from '@/components/LeaderboardChart'

describe('SortedTooltipContent', () => {
  it('passes sorted payload without Recharts applying its default name sorter', () => {
    const payload = [
      { graphicalItemId: 'zulu', name: 'Zulu', value: -100 },
      { graphicalItemId: 'beta', name: 'Beta', value: 250 },
      { graphicalItemId: 'alpha', name: 'Alpha', value: 250 },
      { graphicalItemId: 'gamma', name: 'Gamma', value: 0 },
    ]

    const content = SortedTooltipContent({
      payload,
      itemSorter: 'name',
    } as unknown as Parameters<typeof SortedTooltipContent>[0])

    expect(content.props.payload.map(item => item.name)).toEqual(['Alpha', 'Beta', 'Gamma', 'Zulu'])
    expect(content.props.itemSorter).toBeUndefined()
  })
})
```

- [ ] **步骤 6：运行测试并确认第二次 RED**

运行：`npm test -- lib/chart.test.ts`

预期：测试失败，原因是 `SortedTooltipContent` 尚未导出。

- [ ] **步骤 7：接入 Recharts 默认 Tooltip**

在 `components/LeaderboardChart.tsx` 中：

```tsx
import { DefaultTooltipContent, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { TooltipContentProps, TooltipValueType } from 'recharts'
import { sortTooltipItems } from '@/lib/chart'
```

新增可独立验证的 content 组件。`itemSorter={undefined}` 必须位于 `{...props}` 之后，覆盖 Recharts 3.8.1 注入的默认 `itemSorter="name"`：

```tsx
export function SortedTooltipContent(props: TooltipContentProps<TooltipValueType, string | number>) {
  return (
    <DefaultTooltipContent
      {...props}
      payload={sortTooltipItems(props.payload)}
      itemSorter={undefined}
    />
  )
}
```

再为现有 `<Tooltip>` 设置 `content={SortedTooltipContent}`，并保留现有 `contentStyle`、`formatter` 和 `labelStyle`。

- [ ] **步骤 8：运行单测并确认第二次 GREEN**

运行：`npm test -- lib/chart.test.ts`

预期：排序与 Tooltip 接入测试全部通过。

- [ ] **步骤 9：运行完整测试**

运行：`npm test`

预期：所有 Vitest 测试通过。

- [ ] **步骤 10：运行生产构建**

运行：`npm run build`

预期：Next.js 生产构建成功，无 TypeScript 错误。

- [ ] **步骤 11：检查 diff 格式**

运行：`git diff --check`

预期：命令退出码为 0，无空白错误。

- [ ] **步骤 12：进行浏览器 hover 验证**

运行：`npm run dev`，访问终端输出的本地地址并打开 Leaderboard 的 CHART 视图。前提是本地环境已有 Supabase 配置、可访问会话数据，且至少有两个已结算 session。

在 CNY 与 CHIPS 模式分别 hover 同一日期，确认详情均按显示值降序、同值按名称升序。若本地数据或登录条件不具备，记录无法手工验证的具体原因，以步骤 5 的接入测试和生产构建作为自动化证据。

- [ ] **步骤 13：提交实现**

```bash
git add lib/chart.ts lib/chart.test.ts components/LeaderboardChart.tsx
git commit -m "fix: 按筹码量排序 chart tooltip"
```
