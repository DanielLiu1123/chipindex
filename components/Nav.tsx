'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
  }

  return (
    <header className="border-b border-border">
      <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-accent font-medium tracking-widest text-sm">
          <img src="/icon.svg" alt="" width={20} height={20} />
          CHIPINDEX
        </Link>
        <nav className="flex items-center gap-6">
          {[['/', 'LEADERBOARD'], ['/sessions', 'SESSIONS']].map(([to, label]) => (
            <Link
              key={to}
              href={to}
              className={`text-xs tracking-widest transition-colors ${
                pathname === to ? 'text-white' : 'text-muted hover:text-white'
              }`}
            >
              {label}
            </Link>
          ))}
          <button
            onClick={handleLogout}
            className="text-xs tracking-widest text-muted hover:text-danger transition-colors"
          >
            EXIT
          </button>
        </nav>
      </div>
    </header>
  )
}
