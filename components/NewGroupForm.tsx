'use client'

import PageHeading from '@/components/PageHeading'

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

  return <form onSubmit={submit} className="surface max-w-xl flex flex-col gap-4">
    <PageHeading eyebrow="The private poker ledger" title="NEW GROUP" description="A place for your players and every session you share." />
    <label htmlFor="new-group-name" className="text-sm font-medium">Group name</label>
    <Input id="new-group-name" value={name} onChange={event => setName(event.target.value)} autoFocus placeholder="group name"
       />
    {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
    <Button variant="default" type="submit" disabled={saving || !name.trim()} >
      {saving ? 'CREATING...' : 'CREATE GROUP'}
    </Button>
  </form>
}
