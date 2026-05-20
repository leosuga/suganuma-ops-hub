export function StatCard({
  label,
  value,
  sub,
  color = "text-on-surface",
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="border border-border bg-surface rounded-sm p-4 flex flex-col gap-1">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
        {label}
      </span>
      <span className={`text-[28px] font-mono font-bold leading-none ${color}`}>
        {value}
      </span>
      {sub && (
        <span className="text-[10px] font-mono text-on-surface/30">{sub}</span>
      )}
    </div>
  )
}
