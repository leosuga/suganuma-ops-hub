"use client"

import { MonthRow } from "./MonthRow"
import { YearNavigator } from "./YearNavigator"
import { EventDialog } from "./EventDialog"
import { DayHeader } from "./DayHeader"
import { useAnnualEvents, useCreateAnnualEvent, useUpdateAnnualEvent, useDeleteAnnualEvent, annualEventKeys } from "@/lib/queries/annual"
import { useRealtimeTable } from "@/lib/realtime"
import { useUndoToast } from "@/components/UndoToast"
import { useState, useRef, useEffect } from "react"
import type { AnnualEventRow } from "@/lib/types"

const MONTHS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
]

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function isLeap(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysForMonth(year: number, month: number): number {
  if (month === 1 && isLeap(year)) return 29
  return DAYS_IN_MONTH[month]
}

export function YearView() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const { data: events = [], isLoading } = useAnnualEvents(year)
  const containerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const [dayWidth, setDayWidth] = useState(24)

  const createEvent = useCreateAnnualEvent()
  const updateEvent = useUpdateAnnualEvent()
  const deleteEvent = useDeleteAnnualEvent()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<AnnualEventRow | null>(null)
  const [newDate, setNewDate] = useState<string | null>(null)

  // Dynamic day width
  const maxDays = 31
  useEffect(() => {
    function calc() {
      const el = containerRef.current
      if (!el) return
      const available = el.clientWidth - 36 // label width
      setDayWidth(Math.max(16, Math.floor(available / maxDays)))
    }
    calc()
    window.addEventListener("resize", calc)
    return () => window.removeEventListener("resize", calc)
  }, [maxDays])

  function handleNewEvent(dateStr: string) {
    setEditingEvent(null)
    setNewDate(dateStr)
    setDialogOpen(true)
  }

  function handleEditEvent(event: AnnualEventRow) {
    setEditingEvent(event)
    setNewDate(null)
    setDialogOpen(true)
  }

  function handleSave(title: string, start: string, end: string, color: string, recurrence: string, projectId: string | null) {
    if (editingEvent) {
      updateEvent.mutate({ id: editingEvent.id, title, start_date: start, end_date: end, color, recurrence, project_id: projectId })
    } else if (newDate) {
      createEvent.mutate({ title, start_date: start, end_date: end, color, recurrence, project_id: projectId })
    }
    setDialogOpen(false)
    setEditingEvent(null)
    setNewDate(null)
  }

  // Realtime updates
  useRealtimeTable("annual_event", annualEventKeys.year(year))

  // Undo toast
  const { show: showToast } = useUndoToast()

  function handleDeleteEvent() {
    if (editingEvent) {
      const snapshot = { ...editingEvent }
      deleteEvent.mutate(editingEvent.id)
      setDialogOpen(false)
      setEditingEvent(null)
      setNewDate(null)
      showToast({
        label: `Evento "${snapshot.title}" excluído`,
        onUndo: () => {
          createEvent.mutate({
            title: snapshot.title,
            start_date: snapshot.start_date,
            end_date: snapshot.end_date,
            color: snapshot.color,
            recurrence: snapshot.recurrence,
            project_id: snapshot.project_id,
          })
        },
      })
    }
  }

  function handlePrint() {
    // Aumenta dayWidth temporariamente para impressão em A4 landscape
    setDayWidth(28)
    setTimeout(() => {
      window.print()
      // Restaura após print
      setTimeout(() => {
        const el = containerRef.current
        if (el) {
          const available = el.clientWidth - 36
          setDayWidth(Math.max(16, Math.floor(available / maxDays)))
        }
      }, 1000)
    }, 100)
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 print:hidden">
        <YearNavigator year={year} onChange={setYear} />
        <button
          onClick={handlePrint}
          className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono font-medium text-on-surface/60 bg-surface hover:bg-surface/80 border border-border/50 rounded-md transition-colors"
          title="Exportar PDF"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          PDF
        </button>
      </div>

      {/* Print-only header */}
      <div className="hidden print:block text-center py-4">
        <h1 className="text-xl font-bold text-on-surface">Calendário {year}</h1>
        <p className="text-xs text-on-surface/40 font-mono">Suganuma Ops Hub</p>
      </div>

      <div ref={calendarRef} className="flex-1 overflow-auto relative print:overflow-visible">
        <div className="print:shadow-none" style={{ minWidth: maxDays * dayWidth + 36 }}>
          <DayHeader maxDays={maxDays} dayWidth={dayWidth} />

          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <span className="text-[10px] font-mono text-on-surface/30">Carregando...</span>
            </div>
          ) : (
            MONTHS.map((monthLabel, monthIdx) => {
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
                  events={events}
                  onNewEvent={handleNewEvent}
                  onEditEvent={handleEditEvent}
                  onUpdateEvent={(id, start, end) =>
                    updateEvent.mutate({ id, start_date: start, end_date: end })
                  }
                />
              )
            })
          )}
        </div>
      </div>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialEvent={editingEvent}
        initialDate={newDate}
        onSave={handleSave}
        onDelete={handleDeleteEvent}
      />
    </div>
  )
}
