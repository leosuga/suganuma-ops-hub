interface HabitHeatmapProps {
  habits: { id: string; name: string; emoji?: string; color?: string }[]
  heatmapDays: { dateStr: string; label: string }[]
  entrySet: Set<string>
  buildEntryKey: (habitId: string, dateStr: string) => string
}

export function HabitHeatmap({ habits, heatmapDays, entrySet, buildEntryKey }: HabitHeatmapProps) {
  if (habits.length === 0) return null

  return (
    <div className="border border-border bg-surface rounded-sm p-4 overflow-x-auto">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
        HÁBITOS – ÚLTIMOS {heatmapDays.length} DIAS
      </span>
      <div className="min-w-max">
        <div
          className="grid gap-x-1"
          style={{ gridTemplateColumns: `100px repeat(${heatmapDays.length}, minmax(20px, 1fr))` }}
        >
          <div className="text-[9px] font-mono text-on-surface/20" />
          {heatmapDays.map((day) => (
            <div key={day.dateStr} className="text-center text-[8px] font-mono text-on-surface/20 pb-1">{day.label}</div>
          ))}

          {habits.map((habit) => (
            <div key={habit.id} className="contents">
              <div className="text-[10px] font-mono text-on-surface/50 flex items-center gap-1 py-1 truncate">
                <span>{habit.emoji || "\u25CF"}</span>
                <span className="truncate">{habit.name}</span>
              </div>
              {heatmapDays.map((day) => {
                const done = entrySet.has(buildEntryKey(habit.id, day.dateStr))
                return (
                  <div
                    key={`${habit.id}-${day.dateStr}`}
                    className="flex items-center justify-center py-1"
                  >
                    <div
                      className="w-4 h-4 rounded-[2px]"
                      style={{
                        backgroundColor: done
                          ? habit.color || "var(--color-health)"
                          : "rgba(222,227,229,0.06)",
                      }}
                    />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
