'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { LoaderCircle, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'
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
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { listGroups, logout } from '@/lib/client'
import { isActivePath } from '@/lib/navigation'
import {
  DEFAULT_SESSION_PAGE_SIZE,
  sessionPageHref,
} from '@/lib/session-pagination'
import type { Group } from '@/lib/domain-types'

// The group menu is portaled, so apply the same font explicitly there.
const navigationFont = "font-[-apple-system,BlinkMacSystemFont,Segoe_UI,sans-serif]"

export default function Nav() {
  const pathname = usePathname()
  const router = useRouter()
  const [error, setError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const logoutLabel = loggingOut ? 'Signing out' : 'Sign out'
  const logoutBusy = useRef(false)
  const restoreGroupFocus = useRef(true)
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
    <header className="border-b border-border bg-card">
      <div className="max-w-5xl mx-auto px-4 sm:px-8 min-h-14 [--header-inset:--spacing(2)] py-(--header-inset) flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0 w-full sm:w-auto justify-between sm:justify-start">
          <Link
            href={home}
            className="flex items-center gap-2 text-primary font-semibold tracking-[0.08em] text-sm"
          >
            <Image src="/icon.svg" alt="" width={28} height={28} className="dark:invert" /> CHIPINDEX
          </Link>
          <div
            className={cn(navigationFont, "min-w-0 sm:ml-1 sm:border-l sm:border-border sm:pl-5")}
            onPointerDownCapture={() => { restoreGroupFocus.current = false }}
            onKeyDownCapture={() => { restoreGroupFocus.current = true }}
          >
            <Select value={current?.id ?? ''} onValueChange={changeGroup}>
              <SelectTrigger aria-label="Current group" className="w-auto max-w-[40vw] gap-5 rounded-md border-0 px-1.5 font-medium hover:bg-muted data-[state=open]:bg-muted dark:bg-transparent dark:hover:bg-muted sm:max-w-48">
                <SelectValue placeholder="Select group" />
              </SelectTrigger>
              <SelectContent
                position="popper"
                align="end"
                sideOffset={4}
                className={cn(navigationFont, "min-w-44 max-w-[calc(100vw-2rem)] rounded-[10px] p-1.5")}
                onPointerDownOutside={() => { restoreGroupFocus.current = false }}
                onCloseAutoFocus={(event) => {
                  // Pointer selection should not leave a focus ring; keyboard users return to the trigger.
                  if (!restoreGroupFocus.current) event.preventDefault()
                }}
              >
                {groups.map((group) => (
                  <SelectItem key={group.id} value={group.id} className="min-h-9 pl-2.5 data-[state=checked]:bg-muted">
                    {group.name}
                  </SelectItem>
                ))}
                <SelectSeparator className="mx-0" />
                <SelectItem value="__new__" className="min-h-9 pl-2">+ NEW GROUP</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:w-auto sm:justify-end">
          {manage && (
            <nav
              aria-label="Main navigation"
              className={cn(navigationFont, "flex items-center gap-3 min-[360px]:gap-4 sm:mr-4 sm:gap-6.5")}
            >
              {[
                { label: 'LEADERBOARD', href: home, active: homeActive },
                { label: 'SESSIONS', href: sessions, active: sessionsActive },
                { label: 'MANAGE', href: manage, active: manageActive },
              ].map(({ label, href, active }) => (
                <Link
                  key={label}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    "relative flex h-10 items-center whitespace-nowrap text-xs font-medium tracking-normal text-muted-foreground transition-colors hover:text-foreground min-[360px]:text-[13px] sm:text-sm",
                    active && "text-foreground after:absolute after:inset-x-0 after:bottom-[calc(-1*var(--header-inset))] after:h-0.5 after:rounded-sm after:bg-foreground",
                  )}
                >
                  {label}
                </Link>
              ))}
            </nav>
          )}
          <div className={cn('ml-auto flex shrink-0 items-center sm:gap-1', manage && 'border-l border-border pl-1 sm:pl-2')}>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              type="button"
              aria-label={logoutLabel}
              title={logoutLabel}
              aria-busy={loggingOut}
              disabled={loggingOut}
              onClick={handleLogout}
            >
              {loggingOut ? (
                <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />
              ) : (
                <LogOut aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
    </header>
  )
}
