export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-24 bg-surface rounded mb-6" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="border-b border-border py-4 flex justify-between">
          <div className="h-3 w-28 bg-surface rounded" />
          <div className="h-3 w-16 bg-surface rounded" />
        </div>
      ))}
    </div>
  )
}
