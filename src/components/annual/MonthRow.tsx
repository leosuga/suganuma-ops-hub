"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { isHoliday } from "@/lib/holidays"
import type { AnnualEventRow } from "@/lib/types"
import type { AnnualTaskRow, AnnualAppointmentRow } from "@/lib/queries/annual"

const BAR_HEIGHT = 20
const LANE_GAP = 2
const LABEL_WIDTH = 36
const BASE_ROW_HEIGHT = 32

interface MonthRowProps {
  year: number
  month: number
  monthLabel: string
  days: number
  maxDays: number
  dayWidth: number
  viewMode?: "bars" | "dots"
  events: AnnualEventRow[]
  tasks?: AnnualTaskRow[]
  appointments?: AnnualAppointmentRow[]
  onNewEvent: (dateStr: string) => void
  onEditEvent: (event: AnnualEventRow) => void
  onUpdateEvent: (id: string, start: string, end: string) => void
  onMoveToMonth?: (id: string, fromMonth: number, toMonth: number) => void
}

interface MonthLocalEvent {
  id: string
  title: string
  start_date: string
  end_date: string
  color: string
  startCol: number
  endCol: number
  hasLeftExtension: boolean
  hasRightExtension: boolean
}

function getLocalEvent(
  event: AnnualEventRow,
  year: number,
  month: number,
  days: number
): MonthLocalEvent | null {
  const sd = new Date(event.start_date + "T00:00:00")
  const ed = new Date(event.end_date + "T00:00:00")
  const mStart = new Date(year, month, 1)
  const mEnd = new Date(year, month, days)

  if (ed < mStart || sd > mEnd) return null

  const isStartInMonth = sd.getMonth() === month && sd.getFullYear() === year
  const isEndInMonth = ed.getMonth() === month && ed.getFullYear() === year

  let startCol = isStartInMonth ? sd.getDate() : 1
  let endCol = isEndInMonth ? ed.getDate() : days

  startCol = Math.max(1, Math.min(startCol, days))
  endCol = Math.max(1, Math.min(endCol, days))
  if (endCol < startCol) endCol = startCol

  return {
    id: event.id,
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    color: event.color,
    startCol,
    endCol,
    hasLeftExtension: sd < mStart,
    hasRightExtension: ed > mEnd,
  }
}

function assignLanes(events: MonthLocalEvent[]): Map<string, number> {
  const sorted = [...events].sort((a, b) => a.startCol - b.startCol || a.endCol - b.endCol)
  const lanes: { start: number; end: number }[][] = []
  const mapping = new Map<string, number>()

  for (const event of sorted) {
    let placed = false
    for (let i = 0; i < lanes.length; i++) {
      const overlaps = lanes[i].some((l) => !(l.end < event.startCol || l.start > event.endCol))
      if (!overlaps) {
        lanes[i].push({ start: event.startCol, end: event.endCol })
        mapping.set(event.id, i)
        placed = true
        break
      }
    }
    if (!placed) {
      lanes.push([{ start: event.startCol, end: event.endCol }])
      mapping.set(event.id, lanes.length - 1)
    }
  }

  return mapping
}

interface DragState {
  eventId: string
  type: "left" | "right" | "move"
  startX: number
  startY: number
  originalStartCol: number
  originalEndCol: number
  originalStartDate: string
  originalEndDate: string
  originalMonth: number
}

interface TooltipEvent extends AnnualEventRow {
  clientX: number
  clientY: number
}

export function MonthRow({
  year,
  month,
  monthLabel,
  days,
  maxDays,
  dayWidth,
  viewMode = "bars",
  events,
  tasks = [],
  appointments = [],
  onNewEvent,
  onEditEvent,
  onUpdateEvent,
  onMoveToMonth,
}: MonthRowProps) {
  const [localEvents, setLocalEvents] = useState<MonthLocalEvent[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)
  const [hoveredEvent, setHoveredEvent] = useState<TooltipEvent | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  useEffect(() => {
    const mapped = events
      .map((e) => getLocalEvent(e, year, month, days))
      .filter((e): e is MonthLocalEvent => e !== null)
    setLocalEvents(mapped)
  }, [events, year, month, days])

  const lanes = assignLanes(localEvents)
  const maxLanes = Math.max(0, ...Array.from(lanes.values()))
  const rowHeight = BASE_ROW_HEIGHT + (maxLanes + 1) * (BAR_HEIGHT + LANE_GAP)

  const getDateStr = useCallback(
    (col: number) =>
      `${year}-${String(month + 1).padStart(2, "0")}-${String(col).padStart(2, "0")}`,
    [year, month]
  )

  const colFromX = useCallback(
    (clientX: number) => {
      const rect = rowRef.current?.getBoundingClientRect()
      if (!rect) return 1
      const relativeX = clientX - rect.left - LABEL_WIDTH
      const col = Math.floor(relativeX / dayWidth) + 1
      return Math.max(1, Math.min(days, col))
    },
    [days, dayWidth]
  )

  useEffect(() => {
    if (!drag) return

    function handleMouseMove(e: MouseEvent) {
      if (!drag) return
      const newCol = colFromX(e.clientX)
      setLocalEvents((prev) =>
        prev.map((event) => {
          if (event.id !== drag.eventId) return event
          const ogStart = drag.originalStartCol
          const ogEnd = drag.originalEndCol
          let start = ogStart
          let end = ogEnd

          if (drag.type === "left") {
            start = Math.max(1, Math.min(newCol, ogEnd))
          } else if (drag.type === "right") {
            end = Math.max(ogStart, Math.min(newCol, days))
          } else if (drag.type === "move") {
            const delta = newCol - ogStart
            start = Math.max(1, ogStart + delta)
            end = Math.min(days, ogEnd + delta)
            if (start < 1) { end += 1 - start; start = 1 }
            if (end > days) { start -= end - days; end = days }
          }

          return { ...event, startCol: start, endCol: end }
        })
      )
    }

    function handleMouseUp(e: MouseEvent) {
      if (!drag) return
      const newCol = colFromX(e.clientX)
      const ogStart = drag.originalStartCol
      const ogEnd = drag.originalEndCol
      let startCol = ogStart
      let endCol = ogEnd

      if (drag.type === "left") {
        startCol = Math.max(1, Math.min(newCol, ogEnd))
      } else if (drag.type === "right") {
        endCol = Math.max(ogStart, Math.min(newCol, days))
      } else if (drag.type === "move") {
        const delta = newCol - ogStart
        startCol = Math.max(1, ogStart + delta)
        endCol = Math.min(days, ogEnd + delta)
        if (startCol < 1) { endCol += 1 - startCol; startCol = 1 }
        if (endCol > days) { startCol -= endCol - days; endCol = days }
      }

      if (startCol !== ogStart || endCol !== ogEnd) {
        const origStart = new Date(drag.originalStartDate + "T00:00:00")
        const origEnd = new Date(drag.originalEndDate + "T00:00:00")
        const newStart = new Date(origStart)
        const newEnd = new Date(origEnd)

        if (drag.type === "left") {
          newStart.setDate(origStart.getDate() + (startCol - ogStart))
        } else if (drag.type === "right") {
          newEnd.setDate(origEnd.getDate() + (endCol - ogEnd))
        } else {
          const delta = startCol - ogStart
          newStart.setDate(origStart.getDate() + delta)
          newEnd.setDate(origEnd.getDate() + delta)
        }

        const newStartStr = newStart.toISOString().slice(0, 10)
        const newEndStr = newEnd.toISOString().slice(0, 10)

        if (newStartStr !== drag.originalStartDate || newEndStr !== drag.originalEndDate) {
          onUpdateEvent(drag.eventId, newStartStr, newEndStr)
        }
      }

      setDrag(null)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
    }
  }, [drag, colFromX, days, onUpdateEvent])

  return (
    <div
      ref={rowRef}
      className="flex-none flex select-none relative border-b border-border/30"
      style={{ height: rowHeight }}
    >
      {/* Month label */}
      <div
        className="flex-none flex items-center justify-end pr-1 border-r border-border/50 bg-surface/50 sticky left-0 z-20"
        style={{ width: LABEL_WIDTH }}
      >
        <span className="text-[9px] font-mono font-semibold tracking-wider text-on-surface/50 uppercase">
          {monthLabel}
        </span>
      </div>

      {/* Day columns */}
      <div className="relative flex-1 flex">
        {Array.from({ length: maxDays }, (_, i) => {
          const day = i + 1
          const isValid = day <= days
          const dateStr = getDateStr(day)
          const isToday = dateStr === todayStr
          const isPast = new Date(dateStr) < new Date(todayStr)
          const isHolidayDate = isHoliday(dateStr)
          return (
            <div
              key={day}
              className={cn(
                "flex-none border-r border-border/20 relative",
                !isValid && "bg-on-surface/[0.01] cursor-default",
                isValid && isHolidayDate && "bg-danger/[0.03]",
                isValid && !isHolidayDate && !isToday && !isPast && (day % 2 === 0 ? "bg-transparent" : "bg-surface/[0.02]"),
                isValid && isPast && !isToday && "bg-on-surface/[0.015]",
                isValid && isToday && "bg-teal/[0.10] border-teal/30"
              )}
              style={{ width: dayWidth }}
              onClick={isValid ? () => onNewEvent(dateStr) : undefined}
            >
              {isToday && (
                <div className="absolute top-0 bottom-0 w-px bg-teal/60 z-5" />
              )}
              {isHolidayDate && (
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-danger/30" />
              )}
            </div>
          )
        })}

          {/* Appointment indicators */}
          <div className="absolute top-0 left-0 right-0 h-3 pointer-events-none">
            {appointments
              .filter((a) => {
                const d = new Date(a.starts_at)
                return d.getMonth() === month && d.getFullYear() === year
              })
              .map((appt) => {
                const d = new Date(appt.starts_at)
                const col = d.getDate()
                const apptColor =
                  appt.kind === "consulta" ? "#EF4444" :
                  appt.kind === "exame" ? "#8B5CF6" :
                  appt.kind === "vacina" ? "#10B981" :
                  "#F59E0B"
                return (
                  <div
                    key={`appt-${appt.id}`}
                    className="absolute pointer-events-auto cursor-pointer"
                    style={{
                      left: (col - 1) * dayWidth + dayWidth / 2 - 3,
                      top: 2,
                      width: 0,
                      height: 0,
                      borderLeft: "4px solid transparent",
                      borderRight: "4px solid transparent",
                      borderBottom: `6px solid ${apptColor}`,
                    }}
                    onMouseEnter={(e) => setHoveredEvent({
                      ...appt as any,
                      clientX: e.clientX,
                      clientY: e.clientY,
                    })}
                    onMouseLeave={() => setHoveredEvent(null)}
                    onClick={(e) => {
                      e.stopPropagation()
                      window.location.href = "/health"
                    }}
                  />
                )
              })}
          </div>

          {/* Event bars layer */}
        <div className="absolute inset-0 pointer-events-none">
          {viewMode === "dots"
            ? // Compact dots mode: one dot per day per event
              localEvents.map((event) => {
                const original = events.find((ev) => ev.id === event.id)
                if (!original) return null
                return Array.from({ length: event.endCol - event.startCol + 1 }, (_, i) => {
                  const col = event.startCol + i
                  const dotLeft = (col - 1) * dayWidth + dayWidth / 2 - 3
                  const dotTop = BASE_ROW_HEIGHT / 2 - 3
                  return (
                    <div
                      key={`${event.id}-${col}-dot`}
                      className="absolute z-10 cursor-pointer pointer-events-auto rounded-full"
                      style={{
                        left: dotLeft,
                        top: dotTop,
                        width: 6,
                        height: 6,
                        backgroundColor: event.color,
                      }}
                      onMouseEnter={(e) => setHoveredEvent({ ...original, clientX: e.clientX, clientY: e.clientY })}
                      onMouseLeave={() => setHoveredEvent(null)}
                      onClick={(e) => {
                        e.stopPropagation()
                        onEditEvent(original)
                      }}
                    />
                  )
                })
              })
            : // Default bars mode
              localEvents.map((event) => {
                const lane = lanes.get(event.id) ?? 0
                const barTop = (maxLanes - lane) * (BAR_HEIGHT + LANE_GAP) + LANE_GAP
                const barLeft = (event.startCol - 1) * dayWidth + 2
                const barWidth = (event.endCol - event.startCol + 1) * dayWidth - 4
                const isDragging = drag?.eventId === event.id

                return (
                  <div
                    key={`${event.id}-${month}`}
                    className={cn(
                      "absolute rounded-sm cursor-grab active:cursor-grabbing z-10 transition-opacity pointer-events-auto",
                      isDragging && "opacity-90 z-20"
                    )}
                    style={{
                      top: barTop,
                      left: barLeft,
                      width: Math.max(barWidth, 6),
                      height: BAR_HEIGHT,
                      backgroundColor: event.color + "40",
                      borderLeft: `2px solid ${event.color}`,
                      borderTop: `1px solid ${event.color}`,
                      borderRight: `1px solid ${event.color}`,
                    }}
                    onMouseEnter={(e) => {
                      const original = events.find((ev) => ev.id === event.id)
                      if (original) setHoveredEvent({ ...original, clientX: e.clientX, clientY: e.clientY })
                    }}
                    onMouseLeave={() => setHoveredEvent(null)}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (!drag) {
                        const original = events.find((ev) => ev.id === event.id)
                        if (original) onEditEvent(original)
                      }
                    }}
                  >
                {/* Left bridge indicator */}
                {event.hasLeftExtension && (
                  <div
                    className="absolute -left-1 top-1/2 -translate-y-1/2"
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: "5px solid transparent",
                      borderBottom: "5px solid transparent",
                      borderRight: `6px solid ${event.color}`,
                    }}
                  />
                )}

                {/* Right bridge indicator */}
                {event.hasRightExtension && (
                  <div
                    className="absolute -right-1 top-1/2 -translate-y-1/2"
                    style={{
                      width: 0,
                      height: 0,
                      borderTop: "5px solid transparent",
                      borderBottom: "5px solid transparent",
                      borderLeft: `6px solid ${event.color}`,
                    }}
                  />
                )}

                {/* Left resize handle */}
                <div
                  className="absolute top-0 bottom-0 w-2 cursor-ew-resize z-30 hover:bg-white/20 rounded-l-sm"
                  style={{ left: 0 }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setDrag({
                      eventId: event.id,
                      type: "left",
                      startX: e.clientX,
                      originalStartCol: event.startCol,
                      originalEndCol: event.endCol,
                      originalStartDate: event.start_date,
                      originalEndDate: event.end_date,
                    })
                  }}
                />

                {/* Right resize handle */}
                <div
                  className="absolute top-0 bottom-0 w-2 cursor-ew-resize z-30 hover:bg-white/20 rounded-r-sm"
                  style={{ right: 0 }}
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setDrag({
                      eventId: event.id,
                      type: "right",
                      startX: e.clientX,
                      originalStartCol: event.startCol,
                      originalEndCol: event.endCol,
                      originalStartDate: event.start_date,
                      originalEndDate: event.end_date,
                    })
                  }}
                />

                {/* Drag handle */}
                <div
                  className="absolute inset-2 z-20 cursor-grab active:cursor-grabbing"
                  onMouseDown={(e) => {
                    e.stopPropagation()
                    setDrag({
                      eventId: event.id,
                      type: "move",
                      startX: e.clientX,
                      originalStartCol: event.startCol,
                      originalEndCol: event.endCol,
                      originalStartDate: event.start_date,
                      originalEndDate: event.end_date,
                    })
                  }}
                />

                {barWidth >= 20 && (
                  <span
                    className="absolute inset-0 flex items-center px-1 truncate text-[8px] font-mono text-white/90 pointer-events-none leading-tight"
                    style={{ textShadow: "0 1px 1px rgba(0,0,0,0.4)" }}
                  >
                    {event.title}
                    {(() => {
                      const original = events.find((ev) => ev.id === event.id)
                      if (original?.recurrence && original.recurrence !== "none") {
                        return <span className="ml-1 text-[6px] opacity-70">↻</span>
                      }
                      return null
                    })()}
                  </span>
                )}
              </div>
            )
          })}

          {/* Tooltip overlay */}
          {hoveredEvent && (
            <div
              className="fixed z-[100] pointer-events-none"
              style={{
                left: hoveredEvent.clientX + 12,
                top: hoveredEvent.clientY - 10,
              }}
            >
              <div className="bg-surface border border-border/50 rounded-md shadow-lg px-3 py-2 min-w-[160px]">
                <p className="text-[10px] font-semibold text-on-surface mb-0.5 truncate">
                  {hoveredEvent.title}
                </p>
                <p className="text-[9px] font-mono text-on-surface/50">
                  {hoveredEvent.start_date} → {hoveredEvent.end_date}
                </p>
                {hoveredEvent.recurrence && hoveredEvent.recurrence !== "none" && (
                  <p className="text-[8px] font-mono text-teal mt-0.5">
                    ↻ {hoveredEvent.recurrence === "weekly" && "Semanal"}
                    {hoveredEvent.recurrence === "monthly" && "Mensal"}
                    {hoveredEvent.recurrence === "yearly" && "Anual"}
                  </p>
                )}
                {hoveredEvent.project_id && (
                  <p className="text-[8px] font-mono text-amber mt-0.5">
                    📁 Projeto: {hoveredEvent.project_name || "Vinculado"}
                  </p>
                )}
          </div>

          {/* Task pills layer */}
          <div className="absolute inset-0 pointer-events-none">
            {tasks
              .filter((t) => {
                const d = new Date(t.due_at + "T00:00:00")
                return d.getMonth() === month && d.getFullYear() === year
              })
              .map((task) => {
                const d = new Date(task.due_at + "T00:00:00")
                const col = d.getDate()
                const isDone = task.status === "done"
                const isUrgent = task.priority === "urgent" || task.priority === "high"
                const taskColor =
                  task.category === "finance" ? "#F59E0B" :
                  task.category === "health" ? "#10B981" :
                  task.category === "personal" ? "#8B5CF6" :
                  task.category === "logistics" ? "#3B82F6" : "#6B7280"

                return (
                  <div
                    key={`task-${task.id}`}
                    className="absolute z-10 cursor-pointer pointer-events-auto rounded-full"
                    style={{
                      left: (col - 1) * dayWidth + dayWidth / 2 - 3,
                      bottom: 2,
                      width: 6,
                      height: 6,
                      backgroundColor: isDone ? "#6B7280" : taskColor,
                      opacity: isDone ? 0.4 : isUrgent ? 1 : 0.7,
                      border: isUrgent && !isDone ? `1px solid ${taskColor}` : "none",
                    }}
                    onMouseEnter={(e) => setHoveredEvent({
                      ...task as any,
                      clientX: e.clientX,
                      clientY: e.clientY,
                    })}
                    onMouseLeave={() => setHoveredEvent(null)}
                    onClick={(e) => {
                      e.stopPropagation()
                      // Navigate to tasks page - could use router
                      window.location.href = `/tasks`
                    }}
                  />
                )
              })}
          </div>
        </div>
          )}
        </div>
      </div>
    </div>
  )
}
