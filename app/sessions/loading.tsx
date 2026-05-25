export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-24 bg-surface rounded mb-6" />
      {[...Array(8)].map((_, i) => (
        <div key={i} className="border-b border-border py-4 flex justify-between gap-4">
          <div className="h-3 w-24 bg-surface rounded" />
          <div className="h-3 w-12 bg-surface rounded" />
          <div className="h-3 w-20 bg-surface rounded" />
          <div className="h-3 w-10 bg-surface rounded" />
        </div>
      ))}
    </div>
  )
}
