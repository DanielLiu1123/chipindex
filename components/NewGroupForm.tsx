'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/client'
import type { Group } from '@/types'

export default function NewGroupForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const group = await api<Group>('POST', '/api/groups', { name })
      router.push(`/groups/${group.id}/settings`)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to create group')
      setSaving(false)
    }
  }

  return <form onSubmit={submit} className="max-w-md flex flex-col gap-4">
    <h1 className="text-xs text-muted tracking-widest">NEW GROUP</h1>
    <input value={name} onChange={event => setName(event.target.value)} autoFocus placeholder="group name"
      className="bg-surface border border-border text-white text-sm px-4 py-2.5 outline-none focus:border-white" />
    {error && <p className="text-xs text-danger">{error}</p>}
    <button disabled={saving || !name.trim()} className="bg-white text-bg text-xs tracking-widest py-3 disabled:opacity-40">
      {saving ? 'CREATING...' : 'CREATE GROUP'}
    </button>
  </form>
}
