'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { Button } from '@/components/ui/button'

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectSeparator,
} from '@/components/ui/select'
import { ThemeToggle } from '@/components/ThemeToggle'
import { errorMessage } from '@/lib/error-message'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Brand from '@/components/Brand'
import { LogOut } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { listGroups, logout } from '@/lib/client'
import { isActivePath } from '@/lib/navigation'
import {
  DEFAULT_SESSION_PAGE_SIZE,
  sessionPageHref,
} from '@/lib/session-pagination'
import type { Group } from '@/lib/domain-types'

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const logoutBusy = useRef(false)
  const [groups, setGroups] = useState<Group[]>([])
  const groupId = pathname.match(/^\/groups\/([^/]+)/)?.[1]
  const current = groups.find((group) => group.id === groupId)

  useEffect(() => {
    let active = true
    const load = () =>
      listGroups()
        .then((groups) => {
          if (active) {
            setGroups(groups)
            setError('')
          }
        })
        .catch((reason) => {
          if (active) setError(errorMessage(reason))
        })
    void load()
    window.addEventListener('chipindex:groups-changed', load)
    return () => {
      active = false
      window.removeEventListener('chipindex:groups-changed', load)
    }
  }, [pathname])

  useEffect(() => {
    if (!groupId || groupId === 'new') return
    document.cookie = `chipindex_group=${groupId}; path=/; max-age=31536000; samesite=lax`
  }, [groupId])

  async function handleLogout() {
    if (logoutBusy.current) return
    logoutBusy.current = true
    setLoggingOut(true)
    setError('')
    try {
      await logout()
      router.push('/login')
      router.refresh()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      logoutBusy.current = false
      setLoggingOut(false)
    }
  }

  function changeGroup(value: string) {
    if (value === '__new__') router.push('/groups/new')
    else router.push(`/groups/${value}`)
  }

  const home = groupId && groupId !== 'new' ? `/groups/${groupId}` : '/'
  const sessionsPath =
    groupId && groupId !== 'new' ? `/groups/${groupId}/sessions` : '/'
  const sessions =
    sessionsPath === '/'
      ? '/'
      : sessionPageHref(sessionsPath, 1, DEFAULT_SESSION_PAGE_SIZE)
  const manage =
    groupId && groupId !== 'new' ? `/groups/${groupId}/settings` : null
  const homeActive = isActivePath(pathname, home)
  const sessionsActive =
    sessionsPath !== '/' && isActivePath(pathname, sessionsPath, true)
  const manageActive = manage !== null && isActivePath(pathname, manage, true)

  return (
    <header className="border-b border-border bg-card/90">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 min-h-20 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex w-full items-center justify-between gap-4 min-w-0 sm:w-auto sm:justify-start">
          <Link
            href={home}
            className="flex items-center gap-2 text-primary font-medium tracking-normal text-sm"
          >
            <Brand compact />
          </Link>
          <Select value={current?.id ?? ''} onValueChange={changeGroup}>
            <SelectTrigger aria-label="Current group" className="w-36 bg-background sm:w-40">
              <SelectValue placeholder="Select group" />
            </SelectTrigger>
            <SelectContent>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
              <SelectSeparator />
              <SelectItem value="__new__">+ NEW GROUP</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <nav aria-label="Main navigation" className="flex w-full flex-wrap items-center gap-0 sm:w-auto sm:gap-1">
          {manage && (
            <>
              <Link
                href={home}
                aria-current={homeActive ? 'page' : undefined}
                className="nav-link"
              >
                LEADERBOARD
              </Link>
              <Link
                href={sessions}
                aria-current={sessionsActive ? 'page' : undefined}
                className="nav-link"
              >
                SESSIONS
              </Link>
              <Link
                href={manage}
                aria-current={manageActive ? 'page' : undefined}
                className="nav-link"
              >
                MANAGE
              </Link>
            </>
          )}
          <div className="ml-auto [&_button]:size-8 sm:ml-3"><ThemeToggle /></div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label="EXIT"
            title="Exit ChipIndex"
            type="button"
            disabled={loggingOut}
            onClick={handleLogout}
          >
            <LogOut aria-hidden="true" />
          </Button>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </nav>
      </div>
    </header>
  )
}
