import type { Metadata } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/ThemeProvider'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Toaster } from '@/components/ui/sonner'
import Nav from '@/components/Nav'
import { isAuthenticated } from '@/lib/auth'
import { Geist } from 'next/font/google'
import { cn } from '@/lib/utils'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'ChipIndex',
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
            <div className="flex justify-end p-4">
              <ThemeToggle />
            </div>
          )}
          <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
