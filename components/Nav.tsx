'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { api } from '@/lib/client'
import type { Group } from '@/types'

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const groupId = pathname.match(/^\/groups\/([^/]+)/)?.[1]
  const current = groups.find(group => group.id === groupId)

  useEffect(() => {
    const load = () => api<Group[]>('GET', '/api/groups').then(setGroups).catch(() => {})
    void load()
    window.addEventListener('chipindex:groups-changed', load)
    return () => window.removeEventListener('chipindex:groups-changed', load)
  }, [pathname])

  useEffect(() => {
    if (!groupId || groupId === 'new') return
    document.cookie = `chipindex_group=${groupId}; path=/; max-age=31536000; samesite=lax`
  }, [groupId])

  async function handleLogout() {
    await api('DELETE', '/api/auth').catch(() => {})
    router.push('/login')
  }

  function changeGroup(value: string) {
    if (value === '__new__') router.push('/groups/new')
    else router.push(`/groups/${value}`)
  }

  const home = groupId && groupId !== 'new' ? `/groups/${groupId}` : '/'
  const sessions = groupId && groupId !== 'new' ? `/groups/${groupId}/sessions` : '/'

  return (
    <header className="border-b border-border">
      <div className="max-w-4xl mx-auto px-6 min-h-12 py-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 min-w-0">
          <Link href={home} className="flex items-center gap-2 text-accent font-medium tracking-widest text-sm">
            <Image src="/icon.svg" alt="" width={20} height={20} /> CHIPINDEX
          </Link>
          <select value={groupId ?? ''} onChange={event => changeGroup(event.target.value)}
            aria-label="Current group"
            className="max-w-40 bg-surface border border-border text-white text-xs px-2 py-1.5 outline-none focus:border-white">
            {!current && <option value="">SELECT GROUP</option>}
            {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
            <option value="__new__">+ NEW GROUP</option>
          </select>
        </div>
        <nav className="flex items-center gap-5">
          <Link href={home} className={`text-xs tracking-widest transition-colors ${pathname === home ? 'text-white' : 'text-muted hover:text-white'}`}>LEADERBOARD</Link>
          <Link href={sessions} className={`text-xs tracking-widest transition-colors ${pathname.startsWith(sessions) && sessions !== '/' ? 'text-white' : 'text-muted hover:text-white'}`}>SESSIONS</Link>
          {groupId && groupId !== 'new' && <Link href={`/groups/${groupId}/settings`} className="text-xs tracking-widest text-muted hover:text-white">MANAGE</Link>}
          <button onClick={handleLogout} className="text-xs tracking-widest text-muted hover:text-danger transition-colors">EXIT</button>
        </nav>
      </div>
    </header>
  )
}
