import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col gap-6 pt-20">
      <p className="text-muted text-xs tracking-widest">404 — NOT FOUND</p>
      <Link href="/" className="text-xs tracking-widest text-muted hover:text-white border border-border hover:border-white px-4 py-2 transition-colors w-fit">
        ← LEADERBOARD
      </Link>
    </div>
  )
}
