import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col gap-6 pt-20">
      <p className="text-muted-foreground text-xs tracking-normal">404 — NOT FOUND</p>
      <Link href="/" className="text-xs tracking-normal text-muted-foreground hover:text-foreground border border-border hover:border-ring px-4 py-2 transition-colors w-fit">
        ← LEADERBOARD
      </Link>
    </div>
  )
}
