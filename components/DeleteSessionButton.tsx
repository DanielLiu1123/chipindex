'use client'

import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'
import { deleteSession } from '@/lib/client'

export default function DeleteSessionButton({ groupId, sessionId }: { groupId: string; sessionId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function handleDelete() {
    await deleteSession(groupId, sessionId)
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
      <Button variant="ghost" type="button"
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        aria-label="Delete session"
        className="size-8 p-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </>
  )
}
