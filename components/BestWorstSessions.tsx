'use client'

import { useRouter } from 'next/navigation'
import ChipValue from '@/components/ChipValue'

interface SessionHighlight {
  session_id: string
  date: string
  cny: number
  chips: number
}

function HighlightCard({
  label,
  session,
  colorClass,
  emptyText,
}: {
  label: string
  session: SessionHighlight | null
  colorClass: string
  emptyText: string
}) {
  const router = useRouter()

  return (
    <div
      className={`flex-1 border border-border rounded p-4 ${session ? 'cursor-pointer hover:bg-surface transition-colors' : 'opacity-40'}`}
      onClick={() => session && router.push(`/sessions/${session.session_id}`)}
    >
      <p className={`text-xs tracking-widest mb-3 ${colorClass}`}>{label}</p>
      {session ? (
        <>
          <p className="text-xs text-muted mb-2">{session.date}</p>
          <ChipValue chips={session.cny} prefix="¥" className="text-lg" />
          <p className="text-xs text-muted mt-1">
            <ChipValue chips={session.chips} /> chips
          </p>
        </>
      ) : (
        <p className="text-sm text-muted">{emptyText}</p>
      )}
    </div>
  )
}

export default function BestWorstSessions({
  best,
  worst,
}: {
  best: SessionHighlight | null
  worst: SessionHighlight | null
}) {
  return (
    <div className="flex gap-4 mb-8">
      <HighlightCard
        label="BEST SESSION"
        session={best}
        colorClass="text-green-500"
        emptyText="No wins yet"
      />
      <HighlightCard
        label="WORST SESSION"
        session={worst}
        colorClass="text-red-500"
        emptyText="No losses yet"
      />
    </div>
  )
}
