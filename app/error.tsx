'use client'

import { Button } from '@/components/ui/button'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col gap-6 pt-20">
      <p className="text-destructive text-xs tracking-normal">SOMETHING WENT WRONG</p>
      <p className="text-muted-foreground text-xs">Something went wrong. Please try again.</p>
      <Button variant="outline" type="button"
        onClick={reset}
        className="w-fit"
      >
        TRY AGAIN
      </Button>
    </div>
  )
}
