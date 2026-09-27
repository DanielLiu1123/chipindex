'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
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
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-sm border-t-4 border-primary shadow-[0_16px_60px_-30px_rgba(0,0,0,0.25)] [--card-spacing:--spacing(8)]">
        <CardHeader className="gap-3"><CardTitle className="text-3xl font-semibold tracking-tight">ChipIndex</CardTitle><CardDescription className="leading-relaxed">Enter your group password to continue.</CardDescription></CardHeader>
        <CardContent>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            type="password" aria-label="Password" className="h-12"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="password"
            autoFocus

          />
          {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button variant="default" className="h-12 tracking-[0.12em]"
            type="submit"
            disabled={loading}

          >
            {loading ? '...' : 'ENTER'}
          </Button>
        </form>
        </CardContent>
      </Card>
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
