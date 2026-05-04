"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useCalendarData } from "@/lib/queries/calendar"
import { useCreateTask } from "@/lib/queries/tasks"
import { useCreateHealthLog } from "@/lib/queries/health"
import { useSetMealPlan } from "@/lib/queries/meals"
import { cn } from "@/lib/utils"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const createTask = useCreateTask()
  const setMealPlan = useSetMealPlan()

  const { from, to, days, firstDow } = useMemo(() => getMonthRange(year, month), [year, month])
  const { data, isLoading } = useCalendarData(from, to)
  const today = new Date().toISOString().slice(0, 10)

  const dayMap = useMemo(() => {
    const map = new Map<string, { appts: { title: string; time: string; kind?: string }[]; tasks: { title: string; priority: string }[]; meals: string[] }>()

    for (const a of data?.appointments ?? []) {
      const d = a.starts_at.slice(0, 10)
      if (!map.has(d)) map.set(d, { appts: [], tasks: [], meals: [] })
      const t = new Date(a.starts_at)
      map.get(d)!.appts.push({ title: a.title, time: t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }), kind: a.kind ?? undefined })
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

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }
  function goToday() { setYear(now.getFullYear()); setMonth(now.getMonth()) }

  const cells: number[] = []
  for (let i = 0; i < firstDow; i++) cells.push(0)
  for (let i = 1; i <= days; i++) cells.push(i)

  const selEntries = selectedDay ? dayMap.get(selectedDay) : null
  const selLabel = selectedDay
    ? new Date(selectedDay + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    : ""

  async function handleQuickTask(e: React.FormEvent, taskInput: string, setTaskInput: (v: string) => void) {
    e.preventDefault()
    if (!selectedDay || !taskInput.trim()) return
    await createTask.mutateAsync({
      title: taskInput.trim(),
      category: "personal",
      priority: "med",
      status: "todo",
      due_at: new Date(selectedDay + "T23:59:00").toISOString(),
    })
    setTaskInput("")
  }

  return (
    <SectionErrorBoundary label="CALENDAR">
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-none">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-semibold tracking-[0.2em] text-on-surface/40 uppercase">CALENDAR</span>
            <button onClick={goToday} className="text-[9px] font-mono text-teal hover:text-teal-hi tracking-wider transition-colors">HOJE</button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center text-on-surface/30 hover:text-on-surface/70 font-mono transition-colors">‹</button>
            <span className="text-[11px] font-mono text-on-surface/60 min-w-36 text-center">{MONTHS[month]} {year}</span>
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
              <div key={d} className="h-7 flex items-center justify-center text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase border-r border-border last:border-r-0">{d}</div>
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
                const isSelected = dateStr === selectedDay

                return (
                  <div
                    key={day}
                    onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                    className={cn(
                      "border-b border-r border-border p-1 min-h-[80px] overflow-hidden cursor-pointer transition-colors hover:bg-surface-hover",
                      isToday && "bg-teal/[0.02]",
                      isSelected && "bg-teal/[0.06] ring-1 ring-teal/40"
                    )}
                  >
                    <span className={cn("text-[10px] font-mono tabular-nums", isToday ? "text-teal font-bold" : "text-on-surface/40")}>{day}</span>
                    {entries && (
                      <div className="mt-0.5 space-y-0">
                        {entries.appts.slice(0, 3).map((a, j) => (
                          <div key={j} className="flex items-center gap-1"><div className={dotClass("health")} /><span className="text-[8px] font-mono text-on-surface/50 truncate">{a.time} {a.title}</span></div>
                        ))}
                        {entries.tasks.slice(0, 3).map((t, j) => (
                          <div key={j} className="flex items-center gap-1"><div className={dotClass(t.priority === "urgent" ? "danger" : "teal")} /><span className={cn("text-[8px] font-mono truncate", t.priority === "urgent" ? "text-danger/70" : "text-on-surface/50")}>{t.title}</span></div>
                        ))}
                        {entries.meals.slice(0, 2).map((m, j) => (
                          <div key={j} className="flex items-center gap-1"><div className={dotClass("amber")} /><span className="text-[8px] font-mono text-on-surface/50 truncate">{m}</span></div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <DayDetailModal
        open={!!selectedDay}
        onOpenChange={(v) => { if (!v) setSelectedDay(null) }}
        date={selectedDay}
        label={selLabel}
        entries={selEntries}
      />
    </SectionErrorBoundary>
  )
}

function DayDetailModal({
  open,
  onOpenChange,
  date,
  label,
  entries,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  date: string | null
  label: string
  entries: { appts: { title: string; time: string; kind?: string }[]; tasks: { title: string; priority: string }[]; meals: string[] } | null | undefined
}) {
  const [taskInput, setTaskInput] = useState("")
  const createTask = useCreateTask()

  async function handleQuickTask(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !taskInput.trim()) return
    await createTask.mutateAsync({
      title: taskInput.trim(),
      category: "personal",
      priority: "med",
      status: "todo",
      due_at: new Date(date + "T23:59:00").toISOString(),
    })
    setTaskInput("")
  }

  if (!date) return null
  const isPast = date < new Date().toISOString().slice(0, 10)
  const isToday = date === new Date().toISOString().slice(0, 10)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-md p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase capitalize">{label}</DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-4">
          {entries ? (
            <div className="space-y-3">
              {entries.appts.length > 0 && (
                <div>
                  <span className="text-[9px] font-mono font-semibold tracking-widest text-health uppercase block mb-1">Consultas</span>
                  {entries.appts.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] font-mono text-on-surface/60">
                      <span className="text-health tabular-nums w-12">{a.time}</span>
                      <span>{a.title}</span>
                      {a.kind && <span className="text-on-surface/30">{a.kind}</span>}
                    </div>
                  ))}
                </div>
              )}
              {entries.tasks.length > 0 && (
                <div>
                  <span className="text-[9px] font-mono font-semibold tracking-widest text-teal uppercase block mb-1">Tasks</span>
                  {entries.tasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                      <span className={cn("w-12 text-right", t.priority === "urgent" ? "text-danger" : "text-teal")}>{t.priority === "urgent" ? "URG" : t.priority.toUpperCase()}</span>
                      <span className="text-on-surface/60 truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              )}
              {entries.meals.length > 0 && (
                <div>
                  <span className="text-[9px] font-mono font-semibold tracking-widest text-amber uppercase block mb-1">Refeições</span>
                  {entries.meals.map((m, i) => (
                    <div key={i} className="text-[11px] font-mono text-on-surface/60">{m}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] font-mono text-on-surface/20">Nenhum evento neste dia</p>
          )}

          {!isPast && (
            <form onSubmit={handleQuickTask} className="flex items-center gap-2">
              <input
                type="text"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="Adicionar task para este dia..."
                className="flex-1 h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
              />
              <button type="submit" disabled={!taskInput.trim() || createTask.isPending} className="h-8 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors flex-none">
                {createTask.isPending ? "..." : "+ ADD"}
              </button>
            </form>
          )}

          <div className="flex gap-2">
            <Link href="/tasks" onClick={() => onOpenChange(false)} className="text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">TASKS →</Link>
            <Link href="/health" onClick={() => onOpenChange(false)} className="text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">HEALTH →</Link>
            <Link href="/meals" onClick={() => onOpenChange(false)} className="text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">MEALS →</Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
