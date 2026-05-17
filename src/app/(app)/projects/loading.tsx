export default function Loading() {
  return (
    <div className="p-4 space-y-5">
      <div className="space-y-2">
        <div className="h-4 w-32 bg-surface rounded-sm animate-pulse" />
        <div className="h-3 w-24 bg-surface rounded-sm animate-pulse" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border border-border bg-surface rounded-sm p-4 h-28 animate-pulse" />
        ))}
      </div>
    </div>
  )
}
