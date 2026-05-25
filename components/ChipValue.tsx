export default function ChipValue({ chips, className = '', prefix = '' }: { chips: number; className?: string; prefix?: string }) {
  const color = chips > 0 ? 'text-accent' : chips < 0 ? 'text-danger' : 'text-muted'
  return (
    <span className={`${color} ${className}`}>
      {chips > 0 ? '+' : ''}{prefix}{chips.toLocaleString()}
    </span>
  )
}
