interface Props {
  chips: number
  className?: string
}

export default function ChipValue({ chips, className = '' }: Props) {
  const color = chips > 0 ? 'text-accent' : chips < 0 ? 'text-danger' : 'text-muted'
  const prefix = chips > 0 ? '+' : ''
  return (
    <span className={`${color} ${className}`}>
      {prefix}{chips.toLocaleString()}
    </span>
  )
}
