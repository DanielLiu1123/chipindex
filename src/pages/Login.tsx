import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../lib/auth'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const ok = await login(password)
    setLoading(false)
    if (ok) {
      navigate('/')
    } else {
      setError(true)
      setPassword('')
    }
  }

  return (
    <div className="min-h-screen bg-bg font-mono flex flex-col items-center justify-center">
      <div className="w-full max-w-xs">
        <p className="text-accent tracking-widest text-sm mb-8">CHIPINDEX</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError(false) }}
            placeholder="password"
            autoFocus
            className={`bg-surface border ${
              error ? 'border-danger' : 'border-border'
            } text-white text-sm px-4 py-3 w-full outline-none focus:border-white transition-colors placeholder:text-muted`}
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
