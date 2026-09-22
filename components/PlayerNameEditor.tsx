'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { errorMessage } from '@/lib/error-message'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { renamePlayer } from '@/lib/client'

export default function PlayerNameEditor({ groupId, id, initialName }: { groupId: string; id: string; initialName: string }) {
  const router = useRouter()
  const [error, setError] = useState('')
  const busy = useRef(false)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(initialName)
  const [savedName, setSavedName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cancelRef = useRef(false)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  async function save() {
    if (busy.current) return
    if (cancelRef.current) {
      cancelRef.current = false
      return
    }
    const trimmed = name.trim()
    if (!trimmed || trimmed === savedName) {
      setName(savedName)
      setEditing(false)
      return
    }
    busy.current = true; setError(''); setSaving(true)
    try {
      await renamePlayer(groupId, id, trimmed)
      setSavedName(trimmed)
      setEditing(false)
      router.refresh()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      busy.current = false; setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') {
      cancelRef.current = true
      setName(savedName)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <div><Input
        ref={inputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="w-48"
      />{error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}</div>
    )
  }

  return (
    <Button variant="ghost" type="button" onClick={() => setEditing(true)}
      >
      {name}
    </Button>
  )
}
