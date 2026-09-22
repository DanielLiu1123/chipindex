'use client'

import { ThemeProvider as NextThemeProvider, useTheme } from 'next-themes'
import { useEffect, type ReactNode } from 'react'

function MigrateThemePreference() {
  const { theme, setTheme } = useTheme()
  useEffect(() => {
    if (theme && theme !== 'light' && theme !== 'dark') setTheme('light')
  }, [theme, setTheme])
  return null
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      themes={['light', 'dark']}
      value={{ light: 'light', dark: 'dark', system: 'light' }}
      disableTransitionOnChange
    >
      <MigrateThemePreference />
      {children}
    </NextThemeProvider>
  )
}
