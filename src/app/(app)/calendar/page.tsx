"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useCalendarData } from "@/lib/queries/calendar"
import { cn } from "@/lib/utils"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
const DAY_NAMES = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]

function getMonthRange(year: number, month: number) {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const from = first.toISOString()
  const to = new Date(last.getFullYear(), last.getMonth(), last.getDate(), 23, 59, 59).toISOString()
  return { from, to, days: last.getDate(), firstDow: first.getDay() === 0 ? 6 : first.getDay() - 1 }
}

function dotClass(color: string) {
  return cn("w-1.5 h-1.5 rounded-full flex-none", color === "teal" ? "bg-teal" : color === "danger" ? "bg-danger" : color === "amber" ? "bg-amber" : "bg-health")
}

export default function CalendarPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const { from, to, days, firstDow } = useMemo(() => getMonthRange(year, month), [year, month])
  const { data, isLoading } = useCalendarData(from, to)
  const today = new Date().toISOString().slice(0, 10)

  const dayMap = useMemo(() => {
    const map = new Map<string, { appts: { title: string; time: string; kind?: string }[]; tasks: { title: string; priority: string }[]; meals: string[] }>()

    for (const a of data?.appointments ?? []) {
      const d = a.starts_at.slice(0, 10)
      if (!map.has(d)) map.set(d, { appts: [], tasks: [], meals: [] })
      const t = new Date(a.starts_at)
      map.get(d)!.appts.push({
        title: a.title,
        time: t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        kind: a.kind ?? undefined,
      })
    }

    for (const t of data?.tasks ?? []) {
      const d = t.due_at!.slice(0, 10)
      if (!map.has(d)) map.set(d, { appts: [], tasks: [], meals: [] })
      map.get(d)!.tasks.push({ title: t.title, priority: t.priority })
    }

    for (const mp of data?.mealPlans ?? []) {
      if (!map.has(mp.date)) map.set(mp.date, { appts: [], tasks: [], meals: [] })
      const name = (mp.meal as unknown as { name?: string } | null)?.name ?? "Refeição"
      map.get(mp.date)!.meals.push(name)
    }

    return map
  }, [data])

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }
  function goToday() {
    setYear(now.getFullYear())
    setMonth(now.getMonth())
  }

  const cells: number[] = []
  for (let i = 0; i < firstDow; i++) cells.push(0)
  for (let i = 1; i <= days; i++) cells.push(i)

  return (
    <SectionErrorBoundary label="CALENDAR">
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-none">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-semibold tracking-[0.2em] text-on-surface/40 uppercase">
              CALENDAR
            </span>
            <button onClick={goToday} className="text-[9px] font-mono text-teal hover:text-teal-hi tracking-wider transition-colors">
              HOJE
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center text-on-surface/30 hover:text-on-surface/70 font-mono transition-colors">‹</button>
            <span className="text-[11px] font-mono text-on-surface/60 min-w-36 text-center">
              {MONTHS[month]} {year}
            </span>
            <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center text-on-surface/30 hover:text-on-surface/70 font-mono transition-colors">›</button>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/tasks" className="text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">TASKS</Link>
            <Link href="/meals" className="text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">MEALS</Link>
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border flex-none">
            {DAY_NAMES.map((d) => (
              <div key={d} className="h-7 flex items-center justify-center text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase border-r border-border last:border-r-0">
                {d}
              </div>
            ))}
          </div>

          {isLoading ? (
            <div className="flex-1 grid grid-cols-7 auto-rows-fr">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="border-b border-r border-border p-1 animate-pulse min-h-[80px]" />
              ))}
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-7 auto-rows-fr overflow-auto">
              {cells.map((day, i) => {
                if (day === 0) return <div key={`e${i}`} className="border-b border-r border-border p-1 min-h-[80px] bg-surface-hover" />
                const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
                const entries = dayMap.get(dateStr)
                const isToday = dateStr === today

                return (
                  <div key={day} className={cn(
                    "border-b border-r border-border p-1 min-h-[80px] overflow-hidden",
                    isToday && "bg-teal/[0.02]"
                  )}>
                    <span className={cn(
                      "text-[10px] font-mono tabular-nums",
                      isToday ? "text-teal font-bold" : "text-on-surface/40"
                    )}>
                      {day}
                    </span>

                    {entries && (
                      <div className="mt-0.5 space-y-0">
                        {entries.appts.slice(0, 3).map((a, j) => (
                          <div key={j} className="flex items-center gap-1">
                            <div className={dotClass("health")} />
                            <span className="text-[8px] font-mono text-on-surface/50 truncate">{a.time} {a.title}</span>
                          </div>
                        ))}
                        {entries.tasks.slice(0, 3).map((t, j) => (
                          <div key={j} className="flex items-center gap-1">
                            <div className={dotClass(t.priority === "urgent" ? "danger" : "teal")} />
                            <span className={cn(
                              "text-[8px] font-mono truncate",
                              t.priority === "urgent" ? "text-danger/70" : "text-on-surface/50"
                            )}>
                              {t.title}
                            </span>
                          </div>
                        ))}
                        {entries.meals.slice(0, 2).map((m, j) => (
                          <div key={j} className="flex items-center gap-1">
                            <div className={dotClass("amber")} />
                            <span className="text-[8px] font-mono text-on-surface/50 truncate">{m}</span>
                          </div>
                        ))}
                        {((entries.appts.length + entries.tasks.length + entries.meals.length) > 5) && (
                          <span className="text-[8px] font-mono text-on-surface/20">
                            +{entries.appts.length + entries.tasks.length + entries.meals.length - 5} mais
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </SectionErrorBoundary>
  )
}
