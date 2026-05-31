"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface DayHeaderProps {
  maxDays: number
  dayWidth: number
}

export function DayHeader({ maxDays, dayWidth }: DayHeaderProps) {
  const today = new Date()
  const todayNum = today.getDate()
  const totalWidth = maxDays * dayWidth

  return (
    <div
      className="flex-none flex border-b border-border/50 bg-surface/30 sticky top-0 z-30"
      style={{ minWidth: totalWidth + 36 }}
    >
      {/* Spacer for month label column */}
      <div className="flex-none" style={{ width: 36 }} />

      <div className="flex" style={{ width: totalWidth }}>
        {Array.from({ length: maxDays }, (_, i) => {
          const day = i + 1
          const isToday = day === todayNum
          const isLast = day === maxDays
          return (
            <div
              key={day}
              className={cn(
                "flex-none flex items-center justify-center text-[8px] font-mono tabular-nums",
                isLast ? "border-r-0" : "border-r border-border/20",
                isToday
                  ? "text-teal font-bold bg-teal/[0.08]"
                  : "text-on-surface/30"
              )}
              style={{ width: dayWidth }}
            >
              {day}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function useDynamicDayWidth(maxDays: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [dayWidth, setDayWidth] = useState(24)

  useEffect(() => {
    function calc() {
      if (ref.current) {
        const available = ref.current.clientWidth - 36 // subtract label
        setDayWidth(Math.max(16, Math.floor(available / maxDays)))
      }
    }
    calc()
    window.addEventListener("resize", calc)
    return () => window.removeEventListener("resize", calc)
  }, [maxDays])

  return { ref, dayWidth }
}
