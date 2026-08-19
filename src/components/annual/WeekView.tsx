"use client"

import { useState } from "react"
import type { AnnualEventRow } from "@/lib/types"

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
const CELL_HEIGHT = 40 // pixels per hour
const HEADER_HEIGHT = 32

interface WeekViewProps {
  year: number
  weekOffset: number
  events: AnnualEventRow[]
  onEditEvent: (event: AnnualEventRow) => void
}

function getWeekDates(year: number, weekOffset: number): Date[] {
  const now = new Date()
  now.setFullYear(year)
  now.setDate(now.getDate() + weekOffset * 7)
  const day = now.getDay()
  const diff = now.getDate() - day
  const sunday = new Date(now)
  sunday.setDate(diff)
  sunday.setHours(0, 0, 0, 0)

  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    dates.push(d)
  }
  return dates
}

export function WeekView({ year, weekOffset, events, onEditEvent }: WeekViewProps) {
  const [hoveredEvent, setHoveredEvent] = useState<AnnualEventRow | null>(null)
  const weekDates = getWeekDates(year, weekOffset)
  const today = new Date()

  // Filter events in this week
  const weekEvents = events.filter((e) => {
    const es = new Date(e.start_date + "T00:00:00")
    const ee = new Date(e.end_date + "T00:00:00")
    const ws = weekDates[0]
    const we = weekDates[6]
    return es <= we && ee >= ws
  })

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-border/30">
        <div className="w-14 flex-none border-r border-border/20">
          <div className="h-8" />
        </div>
        {weekDates.map((d, i) => {
          const isToday =
            d.getDate() === today.getDate() &&
            d.getMonth() === today.getMonth() &&
            d.getFullYear() === today.getFullYear()
          return (
            <div
              key={i}
              className={`flex-1 text-center py-1 border-r border-border/20 ${
                isToday ? "bg-teal/10" : ""
              }`}
            >
              <span className="text-[10px] font-mono text-on-surface/60">{DAYS[i]}</span>
              <span className="text-[10px] font-mono font-bold ml-1 text-on-surface/80">
                {d.getDate()}/{d.getMonth() + 1}
              </span>
            </div>
          )
        })}
      </div>

      <div className="flex-1 overflow-auto relative">
        <div className="flex">
          {/* Hour labels */}
          <div className="w-14 flex-none border-r border-border/20">
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="flex items-start justify-end pr-1 border-b border-border/10"
                style={{ height: CELL_HEIGHT }}
              >
                <span className="text-[8px] font-mono text-on-surface/40 -mt-1">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDates.map((date, dayIndex) => {
            const dayEvents = weekEvents.filter((e) => {
              const es = new Date(e.start_date + "T00:00:00")
              const ee = new Date(e.end_date + "T00:00:00")
              const d = new Date(date)
              return es <= d && ee >= d
            })

            return (
              <div
                key={dayIndex}
                className="flex-1 relative border-r border-border/20"
              >
                {/* Hour grid lines */}
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    className="border-b border-border/10"
                    style={{ height: CELL_HEIGHT }}
                  />
                ))}

                {/* Events */}
                {dayEvents.map((event) => {
                  const startHour = event.start_time
                    ? parseInt(event.start_time.split(":")[0])
                    : 0
                  const startMin = event.start_time
                    ? parseInt(event.start_time.split(":")[1])
                    : 0
                  const endHour = event.end_time
                    ? parseInt(event.end_time.split(":")[0])
                    : 23
                  const endMin = event.end_time
                    ? parseInt(event.end_time.split(":")[1])
                    : 59

                  const top = startHour * CELL_HEIGHT + (startMin / 60) * CELL_HEIGHT
                  const duration =
                    (endHour - startHour) * CELL_HEIGHT +
                    ((endMin - startMin) / 60) * CELL_HEIGHT
                  const height = Math.max(duration, 16)

                  return (
                    <div
                      key={event.id}
                      className="absolute left-0.5 right-0.5 rounded-sm cursor-pointer z-10 overflow-hidden"
                      style={{
                        top,
                        height,
                        backgroundColor: event.color + "40",
                        borderLeft: `2px solid ${event.color}`,
                      }}
                      onMouseEnter={() => setHoveredEvent(event)}
                      onMouseLeave={() => setHoveredEvent(null)}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditEvent(event)
                      }}
                    >
                      <span
                        className="text-[8px] font-mono text-white/90 px-1 truncate block leading-tight"
                        style={{ textShadow: "0 1px 1px rgba(0,0,0,0.4)" }}
                      >
                        {event.title}
                        {event.start_time && (
                          <span className="text-[7px] opacity-70 ml-0.5">
                            {event.start_time.slice(0, 5)}
                          </span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredEvent && (
        <div className="fixed bottom-4 left-4 bg-surface border border-border/50 rounded-md shadow-lg px-3 py-2 z-50">
          <p className="text-[10px] font-semibold text-on-surface">{hoveredEvent.title}</p>
          <p className="text-[9px] font-mono text-on-surface/50">
            {hoveredEvent.start_date} → {hoveredEvent.end_date}
          </p>
          {hoveredEvent.start_time && (
            <p className="text-[8px] font-mono text-teal">
              🕐 {hoveredEvent.start_time.slice(0, 5)} - {hoveredEvent.end_time?.slice(0, 5)}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
