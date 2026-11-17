'use client'

import { type ComponentProps } from 'react'
import PlayerSessionHistoryTable from '@/components/PlayerSessionHistoryTable'
import PaginatedSessions from '@/components/PaginatedSessions'

type Props = Pick<ComponentProps<typeof PlayerSessionHistoryTable>, 'groupId' | 'rows' | 'emptyLabel'> &
  Omit<ComponentProps<typeof PaginatedSessions>, 'children' | 'label' | 'loadingLabel'>

export default function PlayerSessionHistory({ groupId, rows, emptyLabel, ...pagination }: Props) {
  return <PaginatedSessions {...pagination} label="Session history" loadingLabel="Loading session history">
    {loading => <PlayerSessionHistoryTable groupId={groupId} rows={rows} loading={loading} emptyLabel={emptyLabel} />}
  </PaginatedSessions>
}
