export function PeriodFilter({
  value,
  onChange,
}: {
  value: number | "all"
  onChange: (v: number | "all") => void
}) {
  const options: { label: string; value: number | "all" }[] = [
    { label: "7D", value: 7 },
    { label: "30D", value: 30 },
    { label: "90D", value: 90 },
    { label: "TUDO", value: "all" },
  ]

  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`text-[9px] font-mono font-semibold tracking-wider px-2 py-1 rounded-sm transition-colors ${
            value === opt.value
              ? "bg-teal/20 text-teal border border-teal/40"
              : "text-on-surface/40 hover:text-on-surface/60 border border-transparent"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
