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

export function prepareSortedTooltipProps<
  TItem extends TooltipSortItem,
  TProps extends { payload: readonly TItem[]; itemSorter?: unknown },
>(props: TProps) {
  const { payload, itemSorter: _itemSorter, ...rest } = props

  return {
    ...rest,
    payload: sortTooltipItems<TItem>(payload),
    itemSorter: undefined,
  }
}
