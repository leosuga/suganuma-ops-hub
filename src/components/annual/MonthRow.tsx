"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import type { AnnualEventRow } from "@/lib/types"

const DAY_WIDTH = 24
const HEADER_HEIGHT = 24
const LABEL_WIDTH = 36
const BAR_HEIGHT = 20
const LANE_GAP = 2
const BASE_ROW_HEIGHT = 32

interface MonthRowProps {
  year: number
  month: number
  monthLabel: string
  days: number
  events: AnnualEventRow[]
  onNewEvent: (dateStr: string) => void
  onEditEvent: (event: AnnualEventRow) => void
  onUpdateEvent: (id: string, start: string, end: string) => void
}

interface MonthLocalEvent {
  id: string
  title: string
  start_date: string
  end_date: string
  color: string
  startCol: number
  endCol: number
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

  let startCol =
    sd.getMonth() === month && sd.getFullYear() === year ? sd.getDate() : 1
  let endCol =
    ed.getMonth() === month && ed.getFullYear() === year ? ed.getDate() : days

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
  }
}

function assignLanes(events: MonthLocalEvent[]): Map<string, number> {
  const sorted = [...events].sort(
    (a, b) => a.startCol - b.startCol || a.endCol - b.endCol
  )
  const lanes: { start: number; end: number }[][] = []
  const mapping = new Map<string, number>()

  for (const event of sorted) {
    let placed = false
    for (let i = 0; i < lanes.length; i++) {
      const overlaps = lanes[i].some(
        (l) => !(l.end < event.startCol || l.start > event.endCol)
      )
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
  originalStartCol: number
  originalEndCol: number
  originalStartDate: string
  originalEndDate: string
}

export function MonthRow({
  year,
  month,
  monthLabel,
  days,
  events,
  onNewEvent,
  onEditEvent,
  onUpdateEvent,
}: MonthRowProps) {
  const [localEvents, setLocalEvents] = useState<MonthLocalEvent[]>([])
  const [drag, setDrag] = useState<DragState | null>(null)
  const rowRef = useRef<HTMLDivElement>(null)

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
      const col = Math.floor(relativeX / DAY_WIDTH) + 1
      return Math.max(1, Math.min(days, col))
    },
    [days]
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
            if (start < 1) {
              end += 1 - start
              start = 1
            }
            if (end > days) {
              start -= end - days
              end = days
            }
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
        if (startCol < 1) {
          endCol += 1 - startCol
          startCol = 1
        }
        if (endCol > days) {
          startCol -= endCol - days
          endCol = days
        }
      }

      if (startCol !== ogStart || endCol !== ogEnd) {
        const origStart = new Date(drag.originalStartDate + "T00:00:00")
        const origEnd = new Date(drag.originalEndDate + "T00:00:00")
        const newStart = new Date(origStart)
        const newEnd = new Date(origEnd)

        if (drag.type === "left") {
          const delta = startCol - ogStart
          newStart.setDate(origStart.getDate() + delta)
        } else if (drag.type === "right") {
          const delta = endCol - ogEnd
          newEnd.setDate(origEnd.getDate() + delta)
        } else if (drag.type === "move") {
          const delta = startCol - ogStart
          newStart.setDate(origStart.getDate() + delta)
          newEnd.setDate(origEnd.getDate() + delta)
        }

        const newStartStr = newStart.toISOString().slice(0, 10)
        const newEndStr = newEnd.toISOString().slice(0, 10)

        if (
          newStartStr !== drag.originalStartDate ||
          newEndStr !== drag.originalEndDate
        ) {
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
        className="flex-none flex items-center justify-end pr-1 border-r border-border/50 bg-surface/50"
        style={{ width: LABEL_WIDTH }}
      >
        <span className="text-[9px] font-mono font-semibold tracking-wider text-on-surface/50 uppercase">
          {monthLabel}
        </span>
      </div>

      {/* Day columns */}
      <div className="relative flex-1 flex">
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1
          return (
            <div
              key={day}
              className={cn(
                "flex-none border-r border-border/20 cursor-pointer hover:bg-surface-hover/30 transition-colors",
                day % 2 === 0 ? "bg-transparent" : "bg-surface/[0.02]"
              )}
              style={{ width: DAY_WIDTH }}
              onClick={() => onNewEvent(getDateStr(day))}
            />
          )
        })}

        {/* Event bars */}
        {localEvents.map((event) => {
          const lane = lanes.get(event.id) ?? 0
          const barTop =
            (maxLanes - lane) * (BAR_HEIGHT + LANE_GAP) + LANE_GAP
          const barLeft = (event.startCol - 1) * DAY_WIDTH + 2
          const barWidth =
            (event.endCol - event.startCol + 1) * DAY_WIDTH - 4
          const isDragging = drag?.eventId === event.id

          return (
            <div
              key={`${event.id}-${month}`}
              className={cn(
                "absolute rounded-sm overflow-hidden group cursor-grab active:cursor-grabbing z-10 transition-opacity",
                isDragging && "opacity-90 z-20"
              )}
              style={{
                top: barTop,
                left: barLeft,
                width: Math.max(barWidth, 6),
                height: BAR_HEIGHT,
                backgroundColor: event.color + "40",
                borderLeftWidth: 2,
                borderLeftStyle: "solid",
                borderLeftColor: event.color,
                borderTopWidth: 2,
                borderTopStyle: "solid",
                borderTopColor: event.color,
              }}
              onClick={(e) => {
                e.stopPropagation()
                if (!drag) {
                  const original = events.find((ev) => ev.id === event.id)
                  if (original) onEditEvent(original)
                }
              }}
            >
              {/* Left resize handle */}
              <div
                className="absolute top-0 bottom-0 w-2 cursor-ew-resize z-30 hover:bg-white/20"
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
                className="absolute top-0 bottom-0 w-2 cursor-ew-resize z-30 hover:bg-white/20"
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

              {/* Drag handle (center) */}
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

              {/* Title */}
              {barWidth >= 20 && (
                <span
                  className="absolute inset-0 flex items-center px-1 truncate text-[8px] font-mono text-white/90 pointer-events-none leading-tight"
                  style={{ textShadow: "0 1px 1px rgba(0,0,0,0.4)" }}
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
