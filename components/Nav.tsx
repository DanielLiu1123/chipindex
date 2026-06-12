'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '@/lib/client'

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await api('DELETE', '/api/auth').catch(() => {})
    router.push('/login')
  }

  return (
    <header className="border-b border-border">
      <div className="max-w-4xl mx-auto px-6 h-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 text-accent font-medium tracking-widest text-sm">
          <Image src="/icon.svg" alt="" width={20} height={20} />
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
