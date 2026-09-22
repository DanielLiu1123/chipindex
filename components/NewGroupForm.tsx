'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { errorMessage } from '@/lib/error-message'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createGroup } from '@/lib/client'

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
      const group = await createGroup(name)
      router.push(`/groups/${group.id}/settings`)
    } catch (reason) {
      setError(errorMessage(reason))
      setSaving(false)
    }
  }

  return <form onSubmit={submit} className="max-w-md flex flex-col gap-4">
    <h1 className="text-xs text-muted-foreground tracking-normal">NEW GROUP</h1>
    <Input value={name} onChange={event => setName(event.target.value)} autoFocus placeholder="group name"
       />
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <Button variant="default" type="submit" disabled={saving || !name.trim()} >
      {saving ? 'CREATING...' : 'CREATE GROUP'}
    </Button>
  </form>
}
