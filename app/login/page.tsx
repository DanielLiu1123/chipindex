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
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center">
      <div className="w-full max-w-xs">
        <p className="text-accent tracking-widest text-sm mb-8">CHIPINDEX</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false) }}
            placeholder="password"
            autoFocus
            className={`bg-surface border ${error ? 'border-danger' : 'border-border'} text-white text-sm px-4 py-3 w-full outline-none focus:border-white transition-colors placeholder:text-muted`}
          />
          {error && <p className="text-danger text-xs">wrong password</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-white text-bg text-xs font-medium tracking-widest py-3 hover:bg-accent transition-colors disabled:opacity-40"
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
