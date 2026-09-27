'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { ArrowUpRight, LockKeyhole } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { errorMessage } from '@/lib/error-message'
import { login } from '@/lib/client'

function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(password)
      const next = searchParams.get('next') || '/'
      router.push(next)
      router.refresh()
    } catch (reason) {
      setError(errorMessage(reason))
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid overflow-hidden rounded-2xl border border-border bg-card lg:min-h-[560px] lg:grid-cols-[1.15fr_1fr]">
      <section className="brand-art relative overflow-hidden bg-[#235944] p-6 text-[#fffefa] sm:p-12">
        <p className="text-[10px] uppercase tracking-[0.24em] text-[#c4df99]">The private poker ledger</p>
        <h1 className="relative z-10 mt-6 text-4xl sm:mt-10 font-medium leading-[1.05] tracking-[-0.055em] sm:text-6xl">Good company.<br />Great sessions.<br /><span className="text-[#c4df99]">Every chip.</span></h1>
        <p className="relative z-10 mt-6 max-w-xs text-sm leading-7 text-[#e0e8d6]">A shared record of the nights you play.<br />Track the table. Follow the form.</p>
        <div aria-hidden="true" className="relative mt-12 hidden items-end gap-2 sm:flex">
          {[32, 52, 42, 72, 96, 122, 150].map((height, i) => <div key={height} className="w-8 rounded-t-sm bg-[#c4df99] sm:w-10" style={{ height, opacity: 0.25 + i * 0.11 }} />)}
          <span className="mb-1 ml-4 text-[10px] uppercase tracking-[0.18em] text-[#c4df99]">Play. Record. Repeat.</span>
        </div>
      </section>
      <section className="flex flex-col justify-center p-6 sm:p-12">
        <div className="mb-8 flex size-12 items-center justify-center rounded-xl border border-border bg-muted text-primary"><LockKeyhole className="size-5" aria-hidden="true" /></div>
        <p className="eyebrow">Your seat at the table</p>
        <h2 className="text-3xl font-medium tracking-tight">Welcome back.</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">Enter your group password to continue.</p>
        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
          <Label htmlFor="password">Group password</Label>
          <Input id="password" type="password" aria-label="Password" autoComplete="current-password" required
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Enter your password"
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'login-error' : undefined}
            className="h-12"
          />
          {error && <Alert id="login-error" variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" size="lg" disabled={loading} className="mt-2 justify-between">
            {loading ? 'Entering…' : 'Enter ChipIndex'}<ArrowUpRight aria-hidden="true" />
          </Button>
        </form>
        <p className="mt-8 text-xs leading-relaxed text-muted-foreground">Your group. Your games. One shared record.</p>
      </section>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
