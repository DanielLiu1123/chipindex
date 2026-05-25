'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'

export default function DeleteSessionButton({ sessionId }: { sessionId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleDelete() {
    await fetch(`/api/sessions/${sessionId}`, { method: 'DELETE' })
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <ConfirmModal
        open={open}
        title="Delete this session?"
        description="This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setOpen(false)}
      />
      <button
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        className="text-xs font-medium tracking-widest text-red-500 hover:text-red-400 border border-red-500/40 hover:border-red-400 px-2.5 py-1 transition-colors"
      >
        DELETE
      </button>
    </>
  )
}
