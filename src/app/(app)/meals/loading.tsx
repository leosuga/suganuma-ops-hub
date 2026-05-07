export default function Loading() {
  return (
    <div className="p-4 space-y-5">
      <div className="space-y-2">
        <div className="h-4 w-32 bg-surface rounded-sm animate-pulse" />
        <div className="h-3 w-20 bg-surface rounded-sm animate-pulse" />
      </div>
      <div className="border border-border bg-surface rounded-sm h-32 animate-pulse" />
      <div className="border border-border bg-surface rounded-sm h-48 animate-pulse" />
    </div>
  )
}
