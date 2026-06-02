"use client"

import Link from "next/link"
import { useAnnualEvents } from "@/lib/queries/annual"

export function UpcomingEvents() {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const year = now.getFullYear()

  const { data: events = [], isLoading } = useAnnualEvents(year)

  const upcoming = events
    .filter((e) => e.end_date >= todayStr)
    .sort((a, b) => {
      const da = new Date(a.start_date + "T00:00:00")
      const db = new Date(b.start_date + "T00:00:00")
      return da.getTime() - db.getTime()
    })
    .slice(0, 5)

  if (isLoading) return null
  if (upcoming.length === 0) return null

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
          PRÓXIMOS EVENTOS
        </span>
        <Link
          href="/calendar/year"
          className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors"
        >
          CALENDÁRIO →
        </Link>
      </div>
      <div className="divide-y divide-border">
        {upcoming.map((event) => {
          const start = new Date(event.start_date + "T00:00:00")
          const end = new Date(event.end_date + "T00:00:00")
          const dateStr = start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
          const isSingleDay = event.start_date === event.end_date
          const endStr = isSingleDay
            ? ""
            : ` → ${end.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`
          const timeStr = event.start_time ? ` ${event.start_time.slice(0, 5)}` : ""

          return (
            <div key={event.id} className="flex items-center gap-3 h-10 px-4">
              <span
                className="w-2 h-2 rounded-full flex-none"
                style={{ backgroundColor: event.color }}
              />
              <span className="text-[10px] font-mono text-on-surface/50 w-20 flex-none">
                {dateStr}
                {endStr}
                <span className="text-teal">{timeStr}</span>
              </span>
              <span className="flex-1 text-[12px] font-mono text-on-surface truncate">
                {event.title}
              </span>
              {event.project_name && (
                <span className="text-[10px] font-mono text-on-surface/30 truncate max-w-[80px]">
                  {event.project_name}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
