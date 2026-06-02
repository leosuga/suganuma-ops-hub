"use client"

const HOURS = Array.from({ length: 24 }, (_, i) => i)
const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export function WeekView() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 py-1 border-b border-border/30 print:hidden">
        <span className="text-[9px] font-mono text-on-surface/40">View semanal — em desenvolvimento</span>
      </div>
      <div className="flex-1 overflow-auto">
        <div className="grid grid-cols-8">
          <div className="border-r border-border/20">
            {HOURS.map((h) => (
              <div key={h} className="h-10 border-b border-border/10 flex items-center justify-end pr-2">
                <span className="text-[8px] font-mono text-on-surface/30">{String(h).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>
          {DAYS.map((day) => (
            <div key={day} className="border-r border-border/20">
              <div className="text-center py-1 border-b border-border/30">
                <span className="text-[9px] font-mono font-semibold text-on-surface/60">{day}</span>
              </div>
              {HOURS.map((h) => (
                <div key={h} className="h-10 border-b border-border/10 hover:bg-surface/30 transition-colors"
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
