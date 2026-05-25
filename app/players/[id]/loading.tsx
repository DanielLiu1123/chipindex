export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-16 bg-surface rounded mb-6" />
      <div className="flex justify-between mb-8">
        <div className="h-6 w-32 bg-surface rounded" />
        <div className="flex gap-6">
          {[...Array(4)].map((_, i) => <div key={i} className="h-3 w-16 bg-surface rounded" />)}
        </div>
      </div>
      <div className="h-48 bg-surface rounded mb-10" />
      <div className="h-3 w-28 bg-surface rounded mb-4" />
      {[...Array(5)].map((_, i) => (
        <div key={i} className="border-b border-border py-4 flex justify-between gap-4">
          <div className="h-3 w-20 bg-surface rounded" />
          <div className="h-3 w-14 bg-surface rounded" />
          <div className="h-3 w-14 bg-surface rounded" />
          <div className="h-3 w-14 bg-surface rounded" />
        </div>
      ))}
    </div>
  )
}
