'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'
import { deleteSession } from '@/lib/client'

export default function DeleteSessionButton({ groupId, sessionId }: { groupId: string; sessionId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleDelete() {
    await deleteSession(groupId, sessionId).catch(() => {})
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
        className="min-h-11 border border-red-500/40 px-2.5 py-1 text-xs font-medium tracking-widest text-red-500 transition-colors hover:border-red-400 hover:text-red-400 sm:min-h-0"
      >
        DELETE
      </button>
    </>
  )
}
