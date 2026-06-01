"use client"

import { MonthRow } from "./MonthRow"
import { YearNavigator } from "./YearNavigator"
import { EventDialog } from "./EventDialog"
import { DayHeader } from "./DayHeader"
import { ColorLegend } from "./ColorLegend"
import { exportToICal, importFromICal } from "@/lib/ical"
import { cn } from "@/lib/utils"
import { useAnnualEvents, useCreateAnnualEvent, useUpdateAnnualEvent, useDeleteAnnualEvent, annualEventKeys } from "@/lib/queries/annual"
import { useRealtimeTable } from "@/lib/realtime"
import { useUndoToast } from "@/components/UndoToast"
import { useState, useRef, useEffect, useMemo } from "react"
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
  const [activeColors, setActiveColors] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<"bars" | "dots">("bars")

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

  // Filtered events
  const filteredEvents = useMemo(() => {
    if (activeColors.size === 0) return events
    return events.filter((e) => activeColors.has(e.color))
  }, [events, activeColors])

  // Color filter handlers
  function handleToggleColor(color: string) {
    setActiveColors((prev) => {
      const next = new Set(prev)
      if (next.has(color)) {
        next.delete(color)
      } else {
        next.add(color)
      }
      return next
    })
  }

  function handleResetColors() {
    setActiveColors(new Set())
  }

  // Zoom handlers
  function handleZoomIn() {
    setDayWidth((w) => Math.min(60, w + 4))
  }

  function handleZoomOut() {
    setDayWidth((w) => Math.max(14, w - 4))
  }

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

  function handleExportICal() {
    const ics = exportToICal(filteredEvents)
    const blob = new Blob([ics], { type: "text/calendar" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `calendario-${year}.ics`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function handleImportICal(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      if (!content) return
      const imported = importFromICal(content)
      for (const event of imported) {
        createEvent.mutate(event)
      }
    }
    reader.readAsText(file)
    e.target.value = "" // reset
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 print:hidden">
        <div className="flex items-center gap-2">
          <YearNavigator year={year} onChange={setYear} />
          <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("bars")}
              className={cn(
                "px-2 py-1 text-[9px] font-mono transition-colors",
                viewMode === "bars"
                  ? "bg-teal/20 text-teal"
                  : "text-on-surface/40 hover:text-on-surface/60"
              )}
              title="Barras"
            >
              ▬
            </button>
            <button
              onClick={() => setViewMode("dots")}
              className={cn(
                "px-2 py-1 text-[9px] font-mono transition-colors",
                viewMode === "dots"
                  ? "bg-teal/20 text-teal"
                  : "text-on-surface/40 hover:text-on-surface/60"
              )}
              title="Pontos"
            >
              ●
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportICal}
            className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono font-medium text-on-surface/60 bg-surface hover:bg-surface/80 border border-border/50 rounded-md transition-colors"
            title="Exportar iCal (.ics)"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            iCal
          </button>

          <label className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono font-medium text-on-surface/60 bg-surface hover:bg-surface/80 border border-border/50 rounded-md transition-colors cursor-pointer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Import
            <input type="file" accept=".ics,.ical" onChange={handleImportICal} className="sr-only" />
          </label>

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
      </div>

      <ColorLegend
        activeColors={activeColors}
        onToggleColor={handleToggleColor}
        onReset={handleResetColors}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        dayWidth={dayWidth}
      />

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
                  viewMode={viewMode}
                  events={filteredEvents}
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
