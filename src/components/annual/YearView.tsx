"use client"

import { CalendarGrid } from "./CalendarGrid"
import { YearNavigator } from "./YearNavigator"
import { EventDialog } from "./EventDialog"
import { ColorLegend } from "./ColorLegend"
import { WeekView } from "./WeekView"
import { MonthView } from "./MonthView"
import { exportToICal, importFromICal } from "@/lib/ical"
import { cn } from "@/lib/utils"
import { dateStr } from "@/lib/date"
import { useAnnualEvents, useCreateAnnualEvent, useUpdateAnnualEvent, useDeleteAnnualEvent, useUpdateAnnualEventSeries, useDeleteAnnualEventSeries, useAnnualTasks, useAnnualAppointments, annualEventKeys } from "@/lib/queries/annual"
import { useUndoToast } from "@/components/UndoToast"
import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import type { AnnualEventRow } from "@/lib/types"

export function YearView() {
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [dualYear, setDualYear] = useState(false)
  const [calendarView, setCalendarView] = useState<"year" | "month" | "week">("year")
  const [weekOffset, setWeekOffset] = useState(0)
  const [monthViewMonth, setMonthViewMonth] = useState(() => new Date().getMonth())

  const { data: eventsYear1 = [], isLoading: isLoading1 } = useAnnualEvents(year)
  const { data: eventsYear2 = [], isLoading: isLoading2 } = useAnnualEvents(year + 1)
  const { data: tasksYear1 = [] } = useAnnualTasks(year)
  const { data: tasksYear2 = [] } = useAnnualTasks(year + 1)
  const { data: appointmentsYear1 = [] } = useAnnualAppointments(year)
  const { data: appointmentsYear2 = [] } = useAnnualAppointments(year + 1)

  const containerRef = useRef<HTMLDivElement>(null)
  const calendarRef = useRef<HTMLDivElement>(null)
  const [dayWidth, setDayWidth] = useState(24)
  const [activeColors, setActiveColors] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<"bars" | "dots">("bars")

  const createEvent = useCreateAnnualEvent()
  const updateEvent = useUpdateAnnualEvent()
  const deleteEvent = useDeleteAnnualEvent()
  const updateSeries = useUpdateAnnualEventSeries()
  const deleteSeries = useDeleteAnnualEventSeries()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState<AnnualEventRow | null>(null)
  const [newDate, setNewDate] = useState<string | null>(null)

  const allEvents = useMemo(() => {
    if (!dualYear) return eventsYear1
    return [...eventsYear1, ...eventsYear2]
  }, [eventsYear1, eventsYear2, dualYear])

  const maxDays = 31
  useEffect(() => {
    function calc() {
      const el = containerRef.current
      if (!el) return
      const available = el.clientWidth - 36
      const years = dualYear ? 2 : 1
      setDayWidth(Math.max(14, Math.floor(available / (maxDays * years + years - 1))))
    }
    calc()
    window.addEventListener("resize", calc)
    return () => window.removeEventListener("resize", calc)
  }, [maxDays, dualYear])

  const filteredEvents = useMemo(() => {
    if (activeColors.size === 0) return allEvents
    return allEvents.filter((e) => activeColors.has(e.color))
  }, [allEvents, activeColors])

  function handleToggleColor(color: string) {
    setActiveColors((prev) => {
      const next = new Set(prev)
      if (next.has(color)) next.delete(color)
      else next.add(color)
      return next
    })
  }

  function handleResetColors() {
    setActiveColors(new Set())
  }

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

  function handleSave(title: string, start: string, end: string, color: string, recurrence: string, projectId: string | null, startTime: string | null, endTime: string | null, isAllDay: boolean, location: string | null) {
    if (editingEvent) {
      updateEvent.mutate({ id: editingEvent.id, title, start_date: start, end_date: end, color, recurrence, project_id: projectId, start_time: startTime, end_time: endTime, is_all_day: isAllDay, location })
    } else if (newDate) {
      createEvent.mutate({ title, start_date: start, end_date: end, color, recurrence, project_id: projectId, start_time: startTime, end_time: endTime, is_all_day: isAllDay, location })
    }
    setDialogOpen(false)
    setEditingEvent(null)
    setNewDate(null)
  }

  function handleClone(title: string, start: string, end: string, color: string, recurrence: string, projectId: string | null, startTime: string | null, endTime: string | null, isAllDay: boolean, location: string | null) {
    createEvent.mutate({ title, start_date: start, end_date: end, color, recurrence, project_id: projectId, start_time: startTime, end_time: endTime, is_all_day: isAllDay, location })
    setDialogOpen(false)
    setEditingEvent(null)
    setNewDate(null)
  }

  function handleSaveSeries(seriesId: string, title: string, start: string, end: string, color: string, projectId: string | null, startTime: string | null, endTime: string | null, isAllDay: boolean, location: string | null) {
    updateSeries.mutate({ seriesId, title, color, project_id: projectId, start_time: startTime, end_time: endTime, is_all_day: isAllDay, location })
    setDialogOpen(false)
    setEditingEvent(null)
    setNewDate(null)
  }

  function handleDeleteSeries(seriesId: string) {
    deleteSeries.mutate(seriesId)
    setDialogOpen(false)
    setEditingEvent(null)
    setNewDate(null)
  }

  const handleMoveToMonth = useCallback((id: string, fromMonth: number, toMonth: number) => {
    const event = allEvents.find((e) => e.id === id)
    if (!event) return
    const deltaMonths = toMonth - fromMonth
    const start = new Date(event.start_date + "T00:00:00")
    const end = new Date(event.end_date + "T00:00:00")
    const duration = end.getTime() - start.getTime()
    start.setMonth(start.getMonth() + deltaMonths)
    const newEnd = new Date(start.getTime() + duration)
    updateEvent.mutate({
      id,
      start_date: dateStr(start),
      end_date: dateStr(newEnd),
    })
  }, [allEvents, updateEvent])

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
    setDayWidth(28)
    setTimeout(() => {
      window.print()
      setTimeout(() => {
        const el = containerRef.current
        if (el) {
          const available = el.clientWidth - 36
          const years = dualYear ? 2 : 1
          setDayWidth(Math.max(16, Math.floor(available / (maxDays * years + years - 1))))
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
    a.download = `calendario-${year}${dualYear ? `-${year + 1}` : ""}.ics`
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
      for (const event of imported) createEvent.mutate(event)
    }
    reader.readAsText(file)
    e.target.value = ""
  }

  function handleExportPNG() {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
    const rect = calendarRef.current?.getBoundingClientRect()
    if (!rect) return
    svg.setAttribute("width", String(rect.width))
    svg.setAttribute("height", String(rect.height))
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    const foreignObject = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject")
    foreignObject.setAttribute("width", "100%")
    foreignObject.setAttribute("height", "100%")
    const div = document.createElement("div")
    div.innerHTML = calendarRef.current?.innerHTML || ""
    foreignObject.appendChild(div)
    svg.appendChild(foreignObject)
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement("canvas")
    canvas.width = rect.width * 2
    canvas.height = rect.height * 2
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#0A0A0A"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.scale(2, 2)
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `calendario-${year}${dualYear ? `-${year + 1}` : ""}.png`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      })
    }
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)))
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col">
      <div className="flex items-center justify-between px-2 print:hidden">
        <div className="flex items-center gap-2">
          <YearNavigator year={year} onChange={setYear} />
          <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
            <button
              onClick={() => setCalendarView("year")}
              className={cn("px-2 py-1 text-[9px] font-mono transition-colors", calendarView === "year" ? "bg-teal/20 text-teal" : "text-on-surface/40 hover:text-on-surface/60")}
              title="Ano"
            >
              Ano
            </button>
            <button
              onClick={() => setCalendarView("month")}
              className={cn("px-2 py-1 text-[9px] font-mono transition-colors", calendarView === "month" ? "bg-teal/20 text-teal" : "text-on-surface/40 hover:text-on-surface/60")}
              title="Mês"
            >
              Mês
            </button>
            <button
              onClick={() => setCalendarView("week")}
              className={cn("px-2 py-1 text-[9px] font-mono transition-colors", calendarView === "week" ? "bg-teal/20 text-teal" : "text-on-surface/40 hover:text-on-surface/60")}
              title="Semana"
            >
              Sem
            </button>
          </div>
          {calendarView === "week" && (
            <div className="flex items-center gap-1">
              <button onClick={() => setWeekOffset((w) => w - 1)} className="px-1.5 py-0.5 text-[8px] font-mono bg-surface border border-border/40 rounded-sm text-on-surface/60">←</button>
              <span className="text-[9px] font-mono text-on-surface/40">Semana</span>
              <button onClick={() => setWeekOffset((w) => w + 1)} className="px-1.5 py-0.5 text-[8px] font-mono bg-surface border border-border/40 rounded-sm text-on-surface/60">→</button>
            </div>
          )}
          {calendarView === "month" && (
            <div className="flex items-center gap-1">
              <button onClick={() => setMonthViewMonth((m) => (m + 11) % 12)} className="px-1.5 py-0.5 text-[8px] font-mono bg-surface border border-border/40 rounded-sm text-on-surface/60">←</button>
              <span className="text-[9px] font-mono text-on-surface/40">Mês</span>
              <button onClick={() => setMonthViewMonth((m) => (m + 1) % 12)} className="px-1.5 py-0.5 text-[8px] font-mono bg-surface border border-border/40 rounded-sm text-on-surface/60">→</button>
            </div>
          )}
          {calendarView === "year" && (
            <button
              onClick={() => setDualYear((d) => !d)}
              className={cn(
                "px-2 py-1 text-[9px] font-mono border border-border/50 rounded-md transition-colors",
                dualYear
                  ? "bg-teal/20 text-teal border-teal/30"
                  : "text-on-surface/40 hover:text-on-surface/60"
              )}
              title={dualYear ? "1 ano" : "2 anos"}
            >
              {dualYear ? "2y" : "1y"}
            </button>
          )}
          {calendarView === "year" && (
            <div className="flex items-center border border-border/50 rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode("bars")}
                className={cn("px-2 py-1 text-[9px] font-mono transition-colors", viewMode === "bars" ? "bg-teal/20 text-teal" : "text-on-surface/40 hover:text-on-surface/60")}
                title="Barras"
              >
                ▬
              </button>
              <button
                onClick={() => setViewMode("dots")}
                className={cn("px-2 py-1 text-[9px] font-mono transition-colors", viewMode === "dots" ? "bg-teal/20 text-teal" : "text-on-surface/40 hover:text-on-surface/60")}
                title="Pontos"
              >
                ●
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportICal} className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono font-medium text-on-surface/60 bg-surface hover:bg-surface/80 border border-border/50 rounded-md transition-colors" title="Exportar iCal (.ics)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg> iCal
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono font-medium text-on-surface/60 bg-surface hover:bg-surface/80 border border-border/50 rounded-md transition-colors cursor-pointer">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg> Import
            <input type="file" accept=".ics,.ical" onChange={handleImportICal} className="sr-only" />
          </label>
          <button onClick={handleExportPNG} className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono font-medium text-on-surface/60 bg-surface hover:bg-surface/80 border border-border/50 rounded-md transition-colors" title="Exportar PNG">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg> PNG
          </button>
          <button onClick={handlePrint} className="flex items-center gap-1.5 px-3 py-1 text-[10px] font-mono font-medium text-on-surface/60 bg-surface hover:bg-surface/80 border border-border/50 rounded-md transition-colors" title="Exportar PDF">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg> PDF
          </button>
        </div>
      </div>

      <ColorLegend activeColors={activeColors} onToggleColor={handleToggleColor} onReset={handleResetColors} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} dayWidth={dayWidth} />

      <div className="hidden print:block text-center py-4">
        <h1 className="text-xl font-bold text-on-surface">Calendário {year}{dualYear ? ` - ${year + 1}` : ""}</h1>
        <p className="text-xs text-on-surface/40 font-mono">Suganuma Ops Hub</p>
      </div>

      <div ref={calendarRef} className="flex-1 overflow-auto relative print:overflow-visible">
        {calendarView === "month" ? (
          <MonthView
            year={year}
            month={monthViewMonth}
            events={allEvents}
            onNewEvent={handleNewEvent}
            onEditEvent={handleEditEvent}
          />
        ) : calendarView === "week" ? (
          <WeekView
            year={year}
            weekOffset={weekOffset}
            events={allEvents}
            onEditEvent={handleEditEvent}
          />
        ) : (
          <div className={cn("print:shadow-none", dualYear && "flex gap-4")}>
            <CalendarGrid
              year={year}
              dayWidth={dayWidth}
              viewMode={viewMode}
              events={filteredEvents}
              tasks={tasksYear1}
              appointments={appointmentsYear1}
              onNewEvent={handleNewEvent}
              onEditEvent={handleEditEvent}
              onUpdateEvent={(id, start, end) => updateEvent.mutate({ id, start_date: start, end_date: end })}
              onMoveToMonth={handleMoveToMonth}
            />
            {dualYear && (
              <CalendarGrid
                year={year + 1}
                dayWidth={dayWidth}
                viewMode={viewMode}
                events={filteredEvents}
                tasks={tasksYear2}
                appointments={appointmentsYear2}
                onNewEvent={handleNewEvent}
                onEditEvent={handleEditEvent}
                onUpdateEvent={(id, start, end) => updateEvent.mutate({ id, start_date: start, end_date: end })}
                onMoveToMonth={handleMoveToMonth}
              />
            )}
          </div>
        )}
      </div>

      <EventDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialEvent={editingEvent}
        initialDate={newDate}
        onSave={handleSave}
        onDelete={handleDeleteEvent}
        onClone={handleClone}
        onSaveSeries={handleSaveSeries}
        onDeleteSeries={handleDeleteSeries}
      />
    </div>
  )
}
