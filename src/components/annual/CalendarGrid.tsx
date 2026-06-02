"use client"

import { MonthRow } from "./MonthRow"
import { DayHeader } from "./DayHeader"
import type { AnnualEventRow } from "@/lib/types"
import type { AnnualTaskRow, AnnualAppointmentRow } from "@/lib/queries/annual"

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
]

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysForMonth(year: number, month: number): number {
  if (month === 1 && isLeap(year)) return 29
  return DAYS_IN_MONTH[month]
}

interface CalendarGridProps {
  year: number
  dayWidth: number
  viewMode: "bars" | "dots"
  events: AnnualEventRow[]
  tasks?: AnnualTaskRow[]
  appointments?: AnnualAppointmentRow[]
  onNewEvent: (dateStr: string) => void
  onEditEvent: (event: AnnualEventRow) => void
  onUpdateEvent: (id: string, start: string, end: string) => void
  onMoveToMonth?: (id: string, fromMonth: number, toMonth: number) => void
}

export function CalendarGrid({
  year,
  dayWidth,
  viewMode,
  events,
  tasks = [],
  appointments = [],
  onNewEvent,
  onEditEvent,
  onUpdateEvent,
  onMoveToMonth,
}: CalendarGridProps) {
  const maxDays = 31

  return (
    <div style={{ minWidth: maxDays * dayWidth + 36 }}>
      <div className="text-center py-1 border-b border-border/30">
        <span className="text-[11px] font-mono font-bold text-on-surface/70">{year}</span>
      </div>
      <DayHeader maxDays={maxDays} dayWidth={dayWidth} />
      {MONTHS.map((monthLabel, monthIdx) => {
        const days = daysForMonth(year, monthIdx)
        return (
          <MonthRow
            key={monthIdx}
            year={year}
            month={monthIdx}
            monthLabel={monthLabel}
            days={days}
            maxDays={maxDays}
            dayWidth={dayWidth}
            viewMode={viewMode}
            events={events}
            tasks={tasks}
            appointments={appointments}
            onNewEvent={onNewEvent}
            onEditEvent={onEditEvent}
            onUpdateEvent={onUpdateEvent}
            onMoveToMonth={onMoveToMonth}
          />
        )
      })}
    </div>
  )
}
