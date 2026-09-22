'use client'

import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { useBrowserReady } from '@/lib/use-browser-ready'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const ready = useBrowserReady()
  const dark = ready && theme === 'dark'
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </Button>
  )
}
