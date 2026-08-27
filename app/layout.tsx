import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from '@/components/Nav'
import { isAuthenticated } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'ChipIndex',
  icons: {
    icon: '/icon.svg',
    apple: '/icon.svg',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAuthenticated()
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen min-h-dvh bg-bg font-mono">
        {authed && <Nav />}
        <main className="page-shell mx-auto max-w-4xl py-6 sm:py-8">{children}</main>
      </body>
    </html>
  )
}
