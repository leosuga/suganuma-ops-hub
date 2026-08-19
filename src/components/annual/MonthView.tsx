"use client"

import { cn } from "@/lib/utils"
import type { AnnualEventRow } from "@/lib/types"
import { useState } from "react"

const DAYS_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

interface MonthViewProps {
  year: number
  month: number
  events: AnnualEventRow[]
  onNewEvent: (dateStr: string) => void
  onEditEvent: (event: AnnualEventRow) => void
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export function MonthView({ year, month, events, onNewEvent, onEditEvent }: MonthViewProps) {
  const [hoveredEvent, setHoveredEvent] = useState<AnnualEventRow | null>(null)
  const days = daysInMonth(year, month)
  const firstDay = firstDayOfMonth(year, month)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month

  const monthEvents = events.filter((e) => {
    const es = new Date(e.start_date + "T00:00:00")
    const ee = new Date(e.end_date + "T00:00:00")
    const ms = new Date(year, month, 1)
    const me = new Date(year, month, days)
    return es <= me && ee >= ms
  })

  const weeks: (number | null)[][] = []
  let currentWeek: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= days; d++) {
    currentWeek.push(d)
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null)
    weeks.push(currentWeek)
  }

  const MONTHS_PT = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="text-center py-2 border-b border-border/30">
        <span className="text-sm font-bold font-mono text-on-surface">{MONTHS_PT[month]} {year}</span>
      </div>

      <div className="grid grid-cols-7 border-b border-border/20">
        {DAYS_PT.map((day) => (
          <div key={day} className="text-center py-1.5">
            <span className="text-[10px] font-mono font-semibold text-on-surface/50">{day}</span>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 border-b border-border/10">
            {week.map((day, di) => {
              const isToday = isCurrentMonth && day === today.getDate()
              const dateStr = day ? `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` : null

              const dayEvents = day
                ? monthEvents.filter((e) => {
                    const es = new Date(e.start_date + "T00:00:00")
                    const ee = new Date(e.end_date + "T00:00:00")
                    const d = new Date(dateStr + "T00:00:00")
                    return es <= d && ee >= d
                  })
                : []

              return (
                <div
                  key={di}
                  className={cn(
                    "min-h-[80px] p-1 border-r border-border/10 relative",
                    !day && "bg-on-surface/[0.02]",
                    isToday && "bg-teal/10"
                  )}
                  onClick={() => day && dateStr && onNewEvent(dateStr)}
                >
                  {day && (
                    <>
                      <span
                        className={cn(
                          "text-[10px] font-mono font-bold",
                          isToday ? "text-teal" : "text-on-surface/60"
                        )}
                      >
                        {day}
                      </span>
                      <div className="mt-0.5 space-y-0.5">
                        {dayEvents.slice(0, 3).map((event) => (
                          <div
                            key={event.id}
                            className="text-[8px] font-mono truncate px-1 rounded-sm cursor-pointer"
                            style={{
                              backgroundColor: event.color + "30",
                              color: event.color,
                              borderLeft: `2px solid ${event.color}`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onEditEvent(event)
                            }}
                            onMouseEnter={() => setHoveredEvent(event)}
                            onMouseLeave={() => setHoveredEvent(null)}
                          >
                            {event.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <span className="text-[7px] font-mono text-on-surface/40 px-1">
                            +{dayEvents.length - 3}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {hoveredEvent && (
        <div className="fixed bottom-4 left-4 bg-surface border border-border/50 rounded-md shadow-lg px-3 py-2 z-50">
          <p className="text-[10px] font-semibold text-on-surface">{hoveredEvent.title}</p>
          <p className="text-[9px] font-mono text-on-surface/50">{hoveredEvent.start_date} → {hoveredEvent.end_date}</p>
        </div>
      )}
    </div>
  )
}
