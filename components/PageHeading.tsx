import type { ReactNode } from 'react'

export default function PageHeading({ eyebrow, title, description, children }: {
  eyebrow: string
  title: string
  description?: string
  children?: ReactNode
}) {
  return <div className="page-heading">
    <div className="min-w-0">
      <p className="eyebrow">{eyebrow}</p>
      <h1 className="page-title break-words">{title}</h1>
      {description && <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted-foreground">{description}</p>}
    </div>
    {children}
  </div>
}
