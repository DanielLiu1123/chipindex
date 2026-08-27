'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { listGroups, logout } from '@/lib/client'
import { isActivePath } from '@/lib/navigation'
import { DEFAULT_SESSION_PAGE_SIZE, sessionPageHref } from '@/lib/session-pagination'
import type { Group } from '@/lib/domain-types'

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [groupSelectOpen, setGroupSelectOpen] = useState(false)
  const groupSelectRef = useRef<HTMLDivElement>(null)
  const groupId = pathname.match(/^\/groups\/([^/]+)/)?.[1]
  const current = groups.find(group => group.id === groupId)

  useEffect(() => {
    const load = () => listGroups().then(setGroups).catch(() => {})
    void load()
    window.addEventListener('chipindex:groups-changed', load)
    return () => window.removeEventListener('chipindex:groups-changed', load)
  }, [pathname])

  useEffect(() => {
    if (!groupId || groupId === 'new') return
    document.cookie = `chipindex_group=${groupId}; path=/; max-age=31536000; samesite=lax`
  }, [groupId])

  useEffect(() => {
    function closeGroupSelect(event: MouseEvent) {
      if (groupSelectRef.current && !groupSelectRef.current.contains(event.target as Node)) {
        setGroupSelectOpen(false)
      }
    }
    function closeGroupSelectWithEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setGroupSelectOpen(false)
    }
    document.addEventListener('mousedown', closeGroupSelect)
    document.addEventListener('keydown', closeGroupSelectWithEscape)
    return () => {
      document.removeEventListener('mousedown', closeGroupSelect)
      document.removeEventListener('keydown', closeGroupSelectWithEscape)
    }
  }, [])

  async function handleLogout() {
    await logout().catch(() => {})
    router.push('/login')
  }

  function changeGroup(value: string) {
    setGroupSelectOpen(false)
    if (value === '__new__') router.push('/groups/new')
    else router.push(`/groups/${value}`)
  }

  const home = groupId && groupId !== 'new' ? `/groups/${groupId}` : '/'
  const sessionsPath = groupId && groupId !== 'new' ? `/groups/${groupId}/sessions` : '/'
  const sessions = sessionsPath === '/'
    ? '/'
    : sessionPageHref(sessionsPath, 1, DEFAULT_SESSION_PAGE_SIZE)
  const manage = groupId && groupId !== 'new' ? `/groups/${groupId}/settings` : null
  const homeActive = isActivePath(pathname, home)
  const sessionsActive = sessionsPath !== '/' && isActivePath(pathname, sessionsPath, true)
  const manageActive = manage !== null && isActivePath(pathname, manage, true)

  return (
    <header className="border-b border-border">
      <div className="nav-shell mx-auto flex min-h-12 max-w-4xl flex-wrap items-center justify-between gap-2 py-2 sm:gap-3">
        <div className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:gap-4">
          <Link href={home} className="flex shrink-0 items-center gap-2 text-sm font-medium tracking-widest text-accent">
            <Image src="/icon.svg" alt="" width={20} height={20} /> CHIPINDEX
          </Link>
          <div ref={groupSelectRef} className="relative min-w-0 flex-1 sm:w-40 sm:flex-none">
            <button type="button" onClick={() => setGroupSelectOpen(open => !open)}
              aria-label="Current group" aria-haspopup="listbox" aria-expanded={groupSelectOpen}
              className="flex min-h-11 w-full items-center justify-between gap-3 border border-border bg-surface px-3 py-2 text-left text-xs outline-none transition-colors focus:border-white sm:min-h-0">
              <span className={`truncate ${current ? 'text-white' : 'text-muted'}`}>{current?.name ?? 'SELECT GROUP'}</span>
              <svg className={`w-3 h-3 shrink-0 text-muted transition-transform duration-150 ${groupSelectOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {groupSelectOpen && <div role="listbox"
              className="absolute z-50 top-full left-0 w-full mt-1 bg-surface border border-border shadow-lg">
              <div className="overflow-y-auto max-h-48">
                {groups.map(group => <button key={group.id} type="button" role="option"
                  aria-selected={group.id === groupId} onClick={() => changeGroup(group.id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-xs text-left text-white transition-colors hover:bg-white/10">
                  <span className="truncate">{group.name}</span>
                  {group.id === groupId && <svg className="w-3 h-3 shrink-0 text-accent" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M2 6l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>}
                </button>)}
              </div>
              <button type="button" onClick={() => changeGroup('__new__')}
                className="w-full border-t border-border px-3 py-2.5 text-xs text-left text-muted transition-colors hover:bg-white/10 hover:text-white">
                + NEW GROUP
              </button>
            </div>}
          </div>
        </div>
        <nav className={manage
          ? 'grid w-full grid-cols-4 items-center gap-1 sm:flex sm:w-auto sm:gap-5'
          : 'flex w-full items-center justify-end sm:w-auto'}>
          {manage && (
            <>
              <Link href={home} aria-current={homeActive ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center justify-center px-1 text-[10px] tracking-widest transition-colors sm:min-h-0 sm:px-0 sm:text-xs ${homeActive ? 'text-white' : 'text-muted hover:text-white'}`}>
                <span className="sm:hidden">BOARD</span><span className="hidden sm:inline">LEADERBOARD</span>
              </Link>
              <Link href={sessions} aria-current={sessionsActive ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center justify-center px-1 text-[10px] tracking-widest transition-colors sm:min-h-0 sm:px-0 sm:text-xs ${sessionsActive ? 'text-white' : 'text-muted hover:text-white'}`}>SESSIONS</Link>
              <Link href={manage} aria-current={manageActive ? 'page' : undefined}
                className={`inline-flex min-h-11 items-center justify-center px-1 text-[10px] tracking-widest transition-colors sm:min-h-0 sm:px-0 sm:text-xs ${manageActive ? 'text-white' : 'text-muted hover:text-white'}`}>MANAGE</Link>
            </>
          )}
          <button onClick={handleLogout}
            className="inline-flex min-h-11 items-center justify-center px-1 text-[10px] tracking-widest text-muted transition-colors hover:text-danger sm:min-h-0 sm:px-0 sm:text-xs">EXIT</button>
        </nav>
      </div>
    </header>
  )
}
