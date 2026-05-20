export function SimpleBarChart({
  data,
  keys,
  colors,
  labels,
  height = 140,
}: {
  data: { [key: string]: number | string; label: string }[]
  keys: string[]
  colors: string[]
  labels: string[]
  height?: number
}) {
  const max = Math.max(
    1,
    ...data.flatMap((d) => keys.map((k) => Number(d[k] || 0)))
  )

  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-0 flex items-end gap-[2px]">
        {data.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col justify-end gap-[1px]">
            {keys.map((k, ki) => {
              const value = Number(item[k] || 0)
              const h = value > 0 ? `${(value / max) * 100}%` : "0%"
              return (
                <div
                  key={k}
                  className="w-full rounded-t-[2px] transition-all duration-300"
                  style={{ height: h, backgroundColor: colors[ki] }}
                  title={`${labels[ki]}: ${value}`}
                />
              )
            })}
          </div>
        ))}
      </div>
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-[1px] pt-2">
        {data.map((item, idx) => (
          <span
            key={idx}
            className="text-[8px] font-mono text-on-surface/30 flex-1 text-center"
          >
            {typeof item.label === "string" ? item.label : ""}
          </span>
        ))}
      </div>
    </div>
  )
}
