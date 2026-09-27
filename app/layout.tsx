import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Toaster } from '@/components/ui/sonner'
import Nav from '@/components/Nav'
import Brand from '@/components/Brand'
import Link from 'next/link'
import { isAuthenticated } from '@/lib/auth'
import { Geist } from 'next/font/google'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'ChipIndex — Every session counts',
  description: 'Your private poker ledger. Track sessions, follow player performance, and keep every chip accounted for.',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const authed = await isAuthenticated()
  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={cn('font-sans', geist.variable)}
    >
      <body className="min-h-screen bg-background font-sans">
        <ThemeProvider>
          {authed ? (
            <Nav />
          ) : (
            <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-8">
              <Link href="/" aria-label="ChipIndex home"><Brand /></Link>
              <ThemeToggle />
            </header>
          )}
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">Skip to content</a>
          <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 sm:py-12">{children}</main>
          <footer className="mx-auto mt-8 flex max-w-6xl flex-wrap justify-between gap-2 border-t border-border px-4 py-6 text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:px-8">
            <span>ChipIndex / The private poker ledger</span><span>Every session counts.</span>
          </footer>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
