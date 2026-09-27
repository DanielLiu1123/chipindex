import Link from 'next/link'
import PageHeading from '@/components/PageHeading'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return <section className="surface my-10">
    <PageHeading eyebrow="404 / Not found" title="This seat is empty." description="We couldn’t find this page. Head back to your table to continue." />
    <Button asChild><Link href="/">← LEADERBOARD</Link></Button>
  </section>
}
