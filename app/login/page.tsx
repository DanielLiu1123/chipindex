'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { login } from '@/lib/client'

function LoginForm() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
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
    } catch {
      setError(true)
      setPassword('')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100dvh-3rem)] flex-col items-center justify-center bg-bg sm:min-h-[calc(100dvh-4rem)]">
      <div className="w-full max-w-xs">
        <p className="text-accent tracking-widest text-sm mb-8">CHIPINDEX</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false) }}
            placeholder="password"
            className={`bg-surface border ${error ? 'border-danger' : 'border-border'} text-white text-base px-4 py-3 w-full outline-none focus:border-white transition-colors placeholder:text-muted`}
          />
          {error && <p className="text-danger text-xs">wrong password</p>}
          <button
            type="submit"
            disabled={loading}
            className="min-h-11 bg-white py-3 text-xs font-medium tracking-widest text-bg transition-colors hover:bg-accent disabled:opacity-40"
          >
            {loading ? '...' : 'ENTER'}
          </button>
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
