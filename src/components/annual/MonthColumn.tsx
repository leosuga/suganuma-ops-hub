"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import type { AnnualEventRow } from "@/lib/types"

const DAY_HEIGHT = 16
const BAR_PADDING = 2
const MIN_COL_WIDTH = 120

interface MonthColumnProps {
  year: number
  month: number
  monthLabel: string
  days: number
  events: AnnualEventRow[]
  onNewEvent: (dateStr: string) => void
  onEditEvent: (event: AnnualEventRow) => void
  onUpdateEvent: (id: string, start: string, end: string) => void
  onDeleteEvent?: (id: string) => void
}

interface MonthLocalEvent {
  id: string
  title: string
  start_date: string
  end_date: string
  color: string
  startLocal: number
  endLocal: number
}

function getLocalEvent(event: AnnualEventRow, year: number, month: number, days: number): MonthLocalEvent | null {
  const sd = new Date(event.start_date + "T00:00:00")
  const ed = new Date(event.end_date + "T00:00:00")
  const mStart = new Date(year, month, 1)
  const mEnd = new Date(year, month, days)

  // Evento não cruza este mês
  if (ed < mStart || sd > mEnd) return null

  // Dia local de início dentro deste mês
  let startLocal = sd.getMonth() === month && sd.getFullYear() === year ? sd.getDate() : 1
  // Dia local de fim dentro deste mês
  let endLocal = ed.getMonth() === month && ed.getFullYear() === year ? ed.getDate() : days

  // Clamp
  startLocal = Math.max(1, Math.min(startLocal, days))
  endLocal = Math.max(1, Math.min(endLocal, days))

  if (endLocal < startLocal) endLocal = startLocal

  return {
    id: event.id,
    title: event.title,
    start_date: event.start_date,
    end_date: event.end_date,
    color: event.color,
    startLocal,
    endLocal,
  }
}

function calculateLanes(events: MonthLocalEvent[]): Map<string, number> {
  const sorted = [...events].sort((a, b) => a.startLocal - b.startLocal || a.endLocal - b.endLocal)
  const lanes: { start: number; end: number }[][] = []
  const mapping = new Map<string, number>()

  for (const event of sorted) {
    let placed = false
    for (let laneIdx = 0; laneIdx < lanes.length; laneIdx++) {
      const lane = lanes[laneIdx]
      const overlaps = lane.some((l) => !(l.end < event.startLocal || l.start > event.endLocal))
      if (!overlaps) {
        lane.push({ start: event.startLocal, end: event.endLocal })
        mapping.set(event.id, laneIdx)
        placed = true
        break
      }
    }
    if (!placed) {
      lanes.push([{ start: event.startLocal, end: event.endLocal }])
      mapping.set(event.id, lanes.length - 1)
    }
  }

  return mapping
}

interface DragState {
  eventId: string
  type: "top" | "bottom" | "move"
  startY: number
  originalStartLocal: number
  originalEndLocal: number
  originalStartDate: string
  originalEndDate: string
}

export function MonthColumn({
  year,
  month,
  monthLabel,
  days,
  events,
  onNewEvent,
  onEditEvent,
  onUpdateEvent,
}: MonthColumnProps) {
  const [localEvents, setLocalEvents] = useState<MonthLocalEvent[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mapped = events
      .map((e) => getLocalEvent(e, year, month, days))
      .filter((e): e is MonthLocalEvent => e !== null)
    setLocalEvents(mapped)
  }, [events, year, month, days])

  const lanes = calculateLanes(localEvents)
  const totalLanes = Math.max(1, Math.max(0, ...Array.from(lanes.values())) + 1)
  const columnWidth = Math.max(MIN_COL_WIDTH, 24 + totalLanes * 14)

  const getDateStr = useCallback(
    (day: number) =>
      `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    [year, month]
  )

  const dayFromY = useCallback(
    (clientY: number) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return 1
      const relativeY = clientY - rect.top - 28 // 28px header
      const day = Math.floor(relativeY / DAY_HEIGHT) + 1
      return Math.max(1, Math.min(days, day))
    },
    [days]
  )

  useEffect(() => {
    if (!drag) return

    function handleMouseMove(e: MouseEvent) {
      if (!drag) return
      const newDay = dayFromY(e.clientY)

      setLocalEvents((prev) =>
        prev.map((event) => {
          if (event.id !== drag.eventId) return event
          const ogStart = drag.originalStartLocal
          const ogEnd = drag.originalEndLocal
          let start = ogStart
          let end = ogEnd

          if (drag.type === "top") {
            start = Math.max(1, Math.min(newDay, ogEnd))
          } else if (drag.type === "bottom") {
            end = Math.max(ogStart, Math.min(newDay, days))
          } else if (drag.type === "move") {
            const delta = newDay - ogStart
            start = Math.max(1, ogStart + delta)
            end = Math.min(days, ogEnd + delta)
            if (start < 1) {
              end += 1 - start
              start = 1
            }
            if (end > days) {
              start -= end - days
              end = days
            }
          }

          return { ...event, startLocal: start, endLocal: end }
        })
      )
    }

    function handleMouseUp(e: MouseEvent) {
      if (!drag) return
      const newDay = dayFromY(e.clientY)
      const ogStart = drag.originalStartLocal
      const ogEnd = drag.originalEndLocal
      let startLocal = ogStart
      let endLocal = ogEnd

      if (drag.type === "top") {
        startLocal = Math.max(1, Math.min(newDay, ogEnd))
      } else if (drag.type === "bottom") {
        endLocal = Math.max(ogStart, Math.min(newDay, days))
      } else if (drag.type === "move") {
        const delta = newDay - ogStart
        startLocal = Math.max(1, ogStart + delta)
        endLocal = Math.min(days, ogEnd + delta)
        if (startLocal < 1) {
          endLocal += 1 - startLocal
          startLocal = 1
        }
        if (endLocal > days) {
          startLocal -= endLocal - days
          endLocal = days
        }
      }

      if (startLocal !== ogStart || endLocal !== ogEnd) {
        // Calcular novas datas globais
        const origStart = new Date(drag.originalStartDate + "T00:00:00")
        const origEnd = new Date(drag.originalEndDate + "T00:00:00")
        let newStart = new Date(origStart)
        let newEnd = new Date(origEnd)

        if (drag.type === "top") {
          // Ajustar apenas início - recalcular pelo delta local
          const delta = startLocal - ogStart
          newStart.setDate(origStart.getDate() + delta)
        } else if (drag.type === "bottom") {
          // Ajustar apenas fim
          const delta = endLocal - ogEnd
          newEnd.setDate(origEnd.getDate() + delta)
        } else if (drag.type === "move") {
          // Mover ambos
          const delta = startLocal - ogStart
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
  }, [drag, dayFromY, days, onUpdateEvent])

  return (
    <div
      ref={containerRef}
      className="flex-none flex flex-col border-r border-border/50 relative select-none"
      style={{ width: columnWidth }}
    >
      <div className="h-7 flex items-center justify-center text-[10px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase border-b border-border flex-none">
        {monthLabel}
      </div>

      <div className="relative" style={{ height: days * DAY_HEIGHT }}>
        {/* Day rows background */}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1
          return (
            <div
              key={day}
              className={cn(
                "absolute left-0 right-0 border-b border-border/20 flex items-center cursor-pointer hover:bg-surface-hover/30 transition-colors",
                day % 2 === 0 ? "bg-transparent" : "bg-surface/[0.03]"
              )}
              style={{ top: i * DAY_HEIGHT, height: DAY_HEIGHT }}
              onClick={() => onNewEvent(getDateStr(day))}
            >
              <span className="text-[9px] font-mono tabular-nums text-on-surface/30 w-4 text-right mr-1 flex-none">
                {day}
              </span>
            </div>
          )
        })}

        {/* Event bars */}
        {localEvents.map((event) => {
          const lane = lanes.get(event.id) ?? 0
          const startDay = event.startLocal
          const endDay = event.endLocal
          const top = (startDay - 1) * DAY_HEIGHT + BAR_PADDING
          const height = (endDay - startDay + 1) * DAY_HEIGHT - BAR_PADDING * 2
          const laneWidth = (columnWidth - 24) / totalLanes
          const left = 24 + lane * laneWidth + BAR_PADDING
          const width = laneWidth - BAR_PADDING * 2
          const isDragging = drag?.eventId === event.id

          return (
            <div
              key={`${event.id}-${month}`}
              className={cn(
                "absolute rounded-sm overflow-hidden group cursor-grab active:cursor-grabbing transition-opacity",
                isDragging && "opacity-90 z-10"
              )}
              style={{
                top,
                height: Math.max(height, 8),
                left,
                width: Math.max(width, 4),
                backgroundColor: event.color + "30",
                borderLeft: `2px solid ${event.color}`,
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (!drag) {
                  const original = events.find((ev) => ev.id === event.id)
                  if (original) onEditEvent(original)
                }
              }}
            >
              {/* Top resize handle */}
              <div
                className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize z-20 hover:bg-white/20"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  setDrag({
                    eventId: event.id,
                    type: "top",
                    startY: e.clientY,
                    originalStartLocal: event.startLocal,
                    originalEndLocal: event.endLocal,
                    originalStartDate: event.start_date,
                    originalEndDate: event.end_date,
                  })
                }}
              />

              {/* Bottom resize handle */}
              <div
                className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize z-20 hover:bg-white/20"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  setDrag({
                    eventId: event.id,
                    type: "bottom",
                    startY: e.clientY,
                    originalStartLocal: event.startLocal,
                    originalEndLocal: event.endLocal,
                    originalStartDate: event.start_date,
                    originalEndDate: event.end_date,
                  })
                }}
              />

              {/* Move handle (center) */}
              <div
                className="absolute inset-1.5 z-10 cursor-grab active:cursor-grabbing"
                onMouseDown={(e) => {
                  e.stopPropagation()
                  setDrag({
                    eventId: event.id,
                    type: "move",
                    startY: e.clientY,
                    originalStartLocal: event.startLocal,
                    originalEndLocal: event.endLocal,
                    originalStartDate: event.start_date,
                    originalEndDate: event.end_date,
                  })
                }}
              />

              {/* Title label */}
              {width >= 20 && height >= 12 && (
                <span
                  className="absolute inset-0 flex items-center px-1 truncate text-[8px] font-mono text-white/90 pointer-events-none"
                  style={{ textShadow: "0 1px 1px rgba(0,0,0,0.3)" }}
                >
                  {event.title}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
