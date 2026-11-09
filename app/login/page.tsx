'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, LoaderCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
    <div className="flex min-h-[70svh] items-center justify-center">
      <div className="w-full max-w-xs">
        <h1 className="mb-8 flex items-center justify-center gap-3 text-[28px] font-semibold tracking-tight">
          <Image src="/icon.svg" alt="" width={40} height={40} className="shrink-0 dark:invert" />
          CHIPINDEX
        </h1>
        <form onSubmit={handleSubmit} aria-busy={loading}>
          <div className="flex items-center gap-1 rounded-xl border border-input bg-card p-1 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50">
            <Input
              type="password"
              aria-label="Password"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'login-error' : undefined}
              className="h-11 border-0 bg-transparent px-2.5 shadow-none focus-visible:ring-0 dark:bg-transparent"
              value={password}
              onChange={e => { setPassword(e.target.value); setError('') }}
              placeholder="Password"
              autoComplete="current-password"
              autoFocus
            />
            <Button type="submit" size="icon" className="size-11 shrink-0" disabled={loading} aria-label={loading ? 'Signing in' : 'Enter'}>
              {loading ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : <ArrowRight aria-hidden="true" />}
            </Button>
          </div>
          <div className="mt-3 min-h-5 text-center text-xs text-destructive">
            {error && <p id="login-error" role="alert">{error}</p>}
          </div>
        </form>
      </div>
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
