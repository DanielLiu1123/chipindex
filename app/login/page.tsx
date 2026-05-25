'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/')
      router.refresh()
    } else {
      setError(true)
      setPassword('')
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
