'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PlayerNameEditor({ id, initialName }: { id: string; initialName: string }) {
  const router = useRouter()
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
    setSaving(true)
    const res = await fetch(`/api/players/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    setSaving(false)
    if (res.ok) {
      setSavedName(trimmed)
      setEditing(false)
      router.refresh()
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
      <input
        ref={inputRef}
        value={name}
        onChange={e => setName(e.target.value)}
        onBlur={save}
        onKeyDown={handleKeyDown}
        disabled={saving}
        className="text-white text-lg bg-transparent border-b border-white outline-none w-48 disabled:opacity-50"
      />
    )
  }

  return (
    <button onClick={() => setEditing(true)}
      className="text-white text-lg hover:text-accent transition-colors">
      {name}
    </button>
  )
}
