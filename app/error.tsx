'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col gap-6 pt-20">
      <p className="text-danger text-xs tracking-widest">SOMETHING WENT WRONG</p>
      <p className="text-muted text-xs">{error.message}</p>
      <button
        onClick={reset}
        className="text-xs tracking-widest text-muted hover:text-white border border-border hover:border-white px-4 py-2 transition-colors w-fit"
      >
        TRY AGAIN
      </button>
    </div>
  )
}
