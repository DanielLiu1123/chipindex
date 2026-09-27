import Image from 'next/image'

export default function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="inline-flex shrink-0 items-center gap-2.5">
    <Image src="/icon.svg" alt="" width={36} height={36} priority />
    <span className="text-lg font-semibold tracking-[-0.06em]">chipindex<span className="text-primary">.</span></span>
    {!compact && <span className="ml-3 hidden border-l border-border pl-4 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground md:inline">Every session counts</span>}
  </span>
}
