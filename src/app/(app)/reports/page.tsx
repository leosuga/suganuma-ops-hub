"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function addDays(d: Date, days: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

function startOfWeek(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

function isoWeekKey(d: Date) {
  const s = startOfWeek(d)
  return `${String(s.getDate()).padStart(2, "0")}/${String(s.getMonth() + 1).padStart(2, "0")}`
}

/* ── Simple CSS BarChart component ── */
function SimpleBarChart({
  data,
  keys,
  colors,
  labels,
  height = 140,
}: {
  data: { [key: string]: number | string; label: string }[]
  keys: string[]
  colors: string[]
  labels: string[]
  height?: number
}) {
  const max = Math.max(
    1,
    ...data.flatMap((d) => keys.map((k) => Number(d[k] || 0)))
  )

  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-0 flex items-end gap-[2px]">
        {data.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col justify-end gap-[1px]">
            {keys.map((k, ki) => {
              const value = Number(item[k] || 0)
              const h = value > 0 ? `${(value / max) * 100}%` : "0%"
              return (
                <div
                  key={k}
                  className="w-full rounded-t-[2px] transition-all duration-300"
                  style={{ height: h, backgroundColor: colors[ki] }}
                  title={`${labels[ki]}: ${value}`}
                />
              )
            })}
          </div>
        ))}
      </div>
      {/* X-axis labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-[1px] pt-2">
        {data.map((item, idx) => (
          <span
            key={idx}
            className="text-[8px] font-mono text-on-surface/30 flex-1 text-center"
          >
            {typeof item.label === "string" ? item.label : ""}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ── Period filter pills ── */
function PeriodFilter({
  value,
  onChange,
}: {
  value: number | "all"
  onChange: (v: number | "all") => void
}) {
  const options: { label: string; value: number | "all" }[] = [
    { label: "7D", value: 7 },
    { label: "30D", value: 30 },
    { label: "90D", value: 90 },
    { label: "TUDO", value: "all" },
  ]

  return (
    <div className="flex gap-1">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={`text-[9px] font-mono font-semibold tracking-wider px-2 py-1 rounded-sm transition-colors ${
            value === opt.value
              ? "bg-teal/20 text-teal border border-teal/40"
              : "text-on-surface/30 hover:text-on-surface/60 border border-transparent"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  useTitle("Reports · Suganuma Ops Hub")

  const [tasks, setTasks] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [habits, setHabits] = useState<any[]>([])
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<number | "all">(30)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("task").select("id, completed_at, due_at, created_at").neq("status", "archived"),
      supabase.from("transaction").select("id, kind, amount, occurred_on"),
      supabase.from("habit_track").select("id, name, active, emoji, color"),
      supabase.from("habit_entry").select("habit_id, done_on").limit(500),
    ]).then(([t, tr, h, e]) => {
      setTasks(t.data ?? [])
      setTransactions(tr.data ?? [])
      setHabits(h.data ?? [])
      setEntries(e.data ?? [])
      setLoading(false)
    })
  }, [])

  const getCutoff = useCallback(() => {
    if (period === "all") return null
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() - period)
    return d
  }, [period])

  if (loading) {
    return (
      <SectionErrorBoundary label="REPORTS">
        <div className="p-4 space-y-6 animate-pulse">
          <div className="h-3 bg-surface rounded-sm w-32" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-surface rounded-sm border border-border" />
            ))}
          </div>
          <div className="h-44 bg-surface rounded-sm border border-border" />
          <div className="h-44 bg-surface rounded-sm border border-border" />
        </div>
      </SectionErrorBoundary>
    )
  }

  const cutoff = getCutoff()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Filter data by period
  const filteredTasks = cutoff
    ? tasks.filter((t: any) => t.created_at && new Date(t.created_at) >= cutoff)
    : tasks
  const filteredTransactions = cutoff
    ? transactions.filter((t: any) => t.occurred_on && new Date(t.occurred_on) >= cutoff)
    : transactions
  const filteredEntries = cutoff
    ? entries.filter((e: any) => new Date(e.done_on) >= cutoff)
    : entries

  const total = filteredTasks.length
  const done = filteredTasks.filter((t: any) => t.completed_at).length
  const rate = total > 0 ? Math.round((done / total) * 100) : 0
  const overdue = tasks.filter(
    (t: any) => !t.completed_at && t.due_at && new Date(t.due_at) < new Date()
  ).length

  const inc = filteredTransactions
    .filter((t: any) => t.kind === "income")
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
  const exp = filteredTransactions
    .filter((t: any) => t.kind === "expense" || t.kind === "tax")
    .reduce((s: number, t: any) => s + Number(t.amount), 0)

  const activeHabits = habits.filter((h: any) => h.active)
  const active = activeHabits.length

  // Simple streak calc (max streak across all habits)
  let maxStreak = 0
  for (const h of habits) {
    const days = new Set(
      entries
        .filter((e: any) => e.habit_id === h.id)
        .map((e: any) => new Date(e.done_on).toDateString())
    )
    let streak = 0
    let check = new Date(today)
    while (days.has(check.toDateString())) {
      streak++
      check.setDate(check.getDate() - 1)
    }
    if (streak > maxStreak) maxStreak = streak
  }

  /* ── Weekly task trend ── */
  const taskTrendData = (() => {
    const weeks: { label: string; completed: number; created: number }[] = []
    const weekCount = period === 7 ? 1 : period === 30 ? 4 : period === 90 ? 12 : 8
    for (let i = weekCount - 1; i >= 0; i--) {
      const weekStart = addDays(startOfWeek(today), -i * 7)
      const weekEnd = addDays(weekStart, 7)
      const label = isoWeekKey(weekStart)
      const completed = tasks.filter((t: any) => {
        if (!t.completed_at) return false
        const d = new Date(t.completed_at)
        return d >= weekStart && d < weekEnd
      }).length
      const created = tasks.filter((t: any) => {
        const d = new Date(t.created_at)
        return d >= weekStart && d < weekEnd
      }).length
      weeks.push({ label, completed, created })
    }
    return weeks
  })()

  /* ── Monthly finance trend ── */
  const financeTrendData = (() => {
    const months: { label: string; income: number; expense: number }[] = []
    const monthCount = period === 7 ? 1 : period === 30 ? 1 : period === 90 ? 3 : 6
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
      const income = transactions
        .filter((t: any) => t.kind === "income" && t.occurred_on?.startsWith(ym))
        .reduce((s: number, t: any) => s + Number(t.amount), 0)
      const expense = transactions
        .filter((t: any) => (t.kind === "expense" || t.kind === "tax") && t.occurred_on?.startsWith(ym))
        .reduce((s: number, t: any) => s + Number(t.amount), 0)
      months.push({ label: label.charAt(0).toUpperCase() + label.slice(1), income, expense })
    }
    return months
  })()

  /* ── Heatmap data ── */
  const heatmapDays = (() => {
    const dayCount = period === 7 ? 7 : period === 30 ? 14 : period === 90 ? 30 : 14
    const days: { dateStr: string; label: string }[] = []
    for (let i = dayCount - 1; i >= 0; i--) {
      const d = addDays(today, -i)
      days.push({
        dateStr: d.toDateString(),
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      })
    }
    return days
  })()

  const entrySet = new Set<string>()
  for (const e of filteredEntries) {
    entrySet.add(`${e.habit_id}::${new Date(e.done_on).toDateString()}`)
  }

  return (
    <SectionErrorBoundary label="REPORTS">
      <div className="p-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
            REPORTS
          </h1>
          <PeriodFilter value={period} onChange={setPeriod} />
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-border bg-surface rounded-sm p-4">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-1">
              TASKS – TAXA
            </span>
            <span className="text-xl font-mono font-semibold text-on-surface block">{rate}%</span>
            <span className="text-[10px] font-mono text-on-surface/30 block mt-1">{done}/{total} concluídas</span>
          </div>

          <div className="border border-border bg-surface rounded-sm p-4">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-1">
              TASKS – ATRASADAS
            </span>
            <span className={`text-xl font-mono font-semibold block ${overdue > 0 ? "text-danger" : "text-on-surface"}`}>{overdue}</span>
            <span className="text-[10px] font-mono text-on-surface/30 block mt-1">pendências críticas</span>
          </div>

          <div className="border border-border bg-surface rounded-sm p-4">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-1">
              FINANCEIRO – SALDO
            </span>
            <span className={`text-xl font-mono font-semibold block ${inc - exp >= 0 ? "text-teal" : "text-danger"}`}>{fmt(inc - exp)}</span>
            <span className="text-[10px] font-mono text-on-surface/30 block mt-1">{fmt(inc)} rec / {fmt(exp)} desp</span>
          </div>

          <div className="border border-border bg-surface rounded-sm p-4">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-1">
              HÁBITOS – STREAK MÁX
            </span>
            <span className="text-xl font-mono font-semibold text-health block">{maxStreak}d</span>
            <span className="text-[10px] font-mono text-on-surface/30 block mt-1">{active} ativos</span>
          </div>
        </div>

        {/* Weekly Task Trend */}
        <div className="border border-border bg-surface rounded-sm p-4">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
            TASKS – CONCLUÍDAS POR SEMANA
          </span>
          <div className="mb-4">
            <SimpleBarChart
              data={taskTrendData}
              keys={["completed", "created"]}
              colors={["#55D7ED", "rgba(222,227,229,0.15)"]}
              labels={["Concluídas", "Criadas"]}
            />
          </div>
          <div className="flex gap-4 justify-center">
            <span className="text-[9px] font-mono text-on-surface/30 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#55D7ED]" /> Concluídas
            </span>
            <span className="text-[9px] font-mono text-on-surface/30 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-[rgba(222,227,229,0.15)]" /> Criadas
            </span>
          </div>
        </div>

        {/* Monthly Finance Trend */}
        <div className="border border-border bg-surface rounded-sm p-4">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
            FINANCEIRO – FLUXO MENSAL
          </span>
          <div className="mb-4">
            <SimpleBarChart
              data={financeTrendData}
              keys={["income", "expense"]}
              colors={["#55D7ED", "#FFB4AB"]}
              labels={["Receita", "Despesa"]}
            />
          </div>
          <div className="flex gap-4 justify-center">
            <span className="text-[9px] font-mono text-on-surface/30 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#55D7ED]" /> Receita
            </span>
            <span className="text-[9px] font-mono text-on-surface/30 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm bg-[#FFB4AB]" /> Despesa
            </span>
          </div>
        </div>

        {/* Habit Heatmap */}
        {activeHabits.length > 0 && (
          <div className="border border-border bg-surface rounded-sm p-4 overflow-x-auto">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
              HÁBITOS – ÚLTIMOS {heatmapDays.length} DIAS
            </span>
            <div className="min-w-max">
              <div
                className="grid gap-x-1"
                style={{ gridTemplateColumns: `100px repeat(${heatmapDays.length}, minmax(20px, 1fr))` }}
              >
                <div className="text-[9px] font-mono text-on-surface/20" />
                {heatmapDays.map((day) => (
                  <div key={day.dateStr} className="text-center text-[8px] font-mono text-on-surface/20 pb-1">{day.label}</div>
                ))}

                {activeHabits.map((habit: any) => (
                  <div key={habit.id} className="contents">
                    <div className="text-[10px] font-mono text-on-surface/50 flex items-center gap-1 py-1 truncate">
                      <span>{habit.emoji || "●"}</span>
                      <span className="truncate">{habit.name}</span>
                    </div>
                    {heatmapDays.map((day) => {
                      const key = `${habit.id}::${day.dateStr}`
                      const done = entrySet.has(key)
                      return (
                        <div
                          key={`${habit.id}-${day.dateStr}`}
                          className="flex items-center justify-center py-1"
                        >
                          <div
                            className="w-4 h-4 rounded-[2px]"
                            style={{
                              backgroundColor: done
                                ? habit.color || "var(--color-health)"
                                : "rgba(222,227,229,0.06)",
                            }}
                          />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </SectionErrorBoundary>
  )
}
