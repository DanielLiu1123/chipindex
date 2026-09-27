'use client'

import PageHeading from '@/components/PageHeading'

import { Button } from '@/components/ui/button'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="surface my-10 flex flex-col gap-6">
      <PageHeading eyebrow="Something went wrong" title="Let’s try that again." description="We couldn’t load this page. Please try again." />
      <Button variant="outline" type="button"
        onClick={reset}
        className="w-fit"
      >
        TRY AGAIN
      </Button>
    </div>
  )
}
