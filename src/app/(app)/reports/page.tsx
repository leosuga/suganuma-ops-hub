"use client"

import { useState, useEffect, useMemo } from "react"
import { fetchReports } from "@/lib/queries/reports"
import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"

function formatCurrency(n: number) {
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

/* ── Simple HTML BarChart component ── */
function SimpleBarChart({
  data,
  keys,
  colors,
  labels,
  max,
  height = 140,
}: {
  data: { [key: string]: number; label: string }[]
  keys: string[]
  colors: string[]
  labels: string[]
  max?: number
  height?: number
}) {
  const calculatedMax =
    max !== undefined
      ? max
      : Math.max(1, ...data.flatMap((d) => keys.map((k) => d[k] || 0)))

  return (
    <div className="relative" style={{ height }}>
      <div className="absolute inset-0 flex items-end gap-[2px]">
        {data.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col justify-end gap-[1px]">
            {keys.map((k, ki) => {
              const value = item[k] || 0
              const h = value > 0 ? `${(value / calculatedMax) * 100}%` : "0%"
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

export default function ReportsPage() {
  useTitle("Reports · Suganuma Ops Hub")

  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    fetchReports()
      .then((d) => {
        if (!cancelled) {
          setData(d)
          setIsLoading(false)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e)
          setIsLoading(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  const tasks = data?.tasks ?? []
  const transactions = data?.transactions ?? []
  const habits = data?.habits ?? []
  const entries = data?.entries ?? []
  const today = useMemo(() => new Date(), [])

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t: any) => t.completed_at != null).length
    const overdueTasks = tasks.filter(
      (t: any) => !t.completed_at && t.due_at && new Date(t.due_at) < new Date()
    ).length
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    const income = transactions
      .filter((t: any) => t.kind === "income")
      .reduce((s: number, t: any) => s + Number(t.amount), 0)
    const expense = transactions
      .filter((t: any) => t.kind === "expense" || t.kind === "tax")
      .reduce((s: number, t: any) => s + Number(t.amount), 0)
    const netBalance = income - expense

    const activeHabits = habits.filter((h: any) => h.active).length

    const normalizedToday = new Date(today)
    normalizedToday.setHours(0, 0, 0, 0)
    let maxStreak = 0
    for (const habit of habits) {
      const habitEntries = entries
        .filter((e: any) => e.habit_id === habit.id)
        .map((e: any) => new Date(e.done_on).toDateString())
      const uniqueDays = Array.from(new Set(habitEntries)).sort(
        (a: string, b: string) => new Date(b).getTime() - new Date(a).getTime()
      )
      let streak = 0
      let check = new Date(normalizedToday)
      while (uniqueDays.includes(check.toDateString())) {
        streak++
        check = addDays(check, -1)
      }
      if (streak > maxStreak) maxStreak = streak
    }

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      completionRate,
      income,
      expense,
      netBalance,
      activeHabits,
      maxStreak,
    }
  }, [tasks, transactions, habits, entries, today])

  /* ── Weekly task trend ── */
  const taskTrendData = useMemo(() => {
    const weeks: { label: string; completed: number; created: number }[] = []
    for (let i = 7; i >= 0; i--) {
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
  }, [tasks, today])

  /* ── Monthly finance trend ── */
  const financeTrendData = useMemo(() => {
    const months: { label: string; income: number; expense: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = d
        .toLocaleDateString("pt-BR", { month: "short" })
        .replace(".", "")
      const inc = transactions
        .filter(
          (t: any) => t.kind === "income" && t.occurred_on?.startsWith(ym)
        )
        .reduce((s: number, t: any) => s + Number(t.amount), 0)
      const exp = transactions
        .filter(
          (t: any) =>
            (t.kind === "expense" || t.kind === "tax") &&
            t.occurred_on?.startsWith(ym)
        )
        .reduce((s: number, t: any) => s + Number(t.amount), 0)
      months.push({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        income: inc,
        expense: exp,
      })
    }
    return months
  }, [transactions, today])

  /* ── Heatmap data ── */
  const heatmapDays = useMemo(() => {
    const days: { dateStr: string; label: string }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = addDays(today, -i)
      days.push({
        dateStr: d.toDateString(),
        label: d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
        }),
      })
    }
    return days
  }, [today])

  const activeHabitList = useMemo(() => habits.filter((h: any) => h.active), [habits])

  const entrySet = useMemo(() => {
    const set = new Set<string>()
    for (const e of entries) {
      set.add(`${e.habit_id}::${new Date(e.done_on).toDateString()}`)
    }
    return set
  }, [entries])

  if (isLoading) {
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
          <div className="h-44 bg-surface rounded-sm border border-border" />
        </div>
      </SectionErrorBoundary>
    )
  }

  if (error) {
    return (
      <SectionErrorBoundary label="REPORTS">
        <div className="p-4 space-y-6">
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
            REPORTS
          </h1>
          <div className="border border-danger/30 bg-danger/5 rounded-sm p-4">
            <span className="text-[10px] font-mono text-danger">
              Erro ao carregar dados: {String(error)}
            </span>
          </div>
        </div>
      </SectionErrorBoundary>
    )
  }

  return (
    <SectionErrorBoundary label="REPORTS">
      <div className="p-4 space-y-6">
        <main>
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
            REPORTS
          </h1>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-border bg-surface rounded-sm p-4">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-1">
                TASKS – TAXA
              </span>
              <span className="text-xl font-mono font-semibold text-on-surface block">
                {kpis.completionRate}%
              </span>
              <span className="text-[10px] font-mono text-on-surface/30 block mt-1">
                {kpis.completedTasks}/{kpis.totalTasks} concluídas
              </span>
            </div>

            <div className="border border-border bg-surface rounded-sm p-4">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-1">
                TASKS – ATRASADAS
              </span>
              <span
                className={`text-xl font-mono font-semibold block ${
                  kpis.overdueTasks > 0 ? "text-danger" : "text-on-surface"
                }`}
              >
                {kpis.overdueTasks}
              </span>
              <span className="text-[10px] font-mono text-on-surface/30 block mt-1">
                pendências críticas
              </span>
            </div>

            <div className="border border-border bg-surface rounded-sm p-4">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-1">
                FINANCEIRO – SALDO
              </span>
              <span
                className={`text-xl font-mono font-semibold block ${
                  kpis.netBalance >= 0 ? "text-teal" : "text-danger"
                }`}
              >
                {formatCurrency(kpis.netBalance)}
              </span>
              <span className="text-[10px] font-mono text-on-surface/30 block mt-1">
                {formatCurrency(kpis.income)} rec /{" "}
                {formatCurrency(kpis.expense)} desp
              </span>
            </div>

            <div className="border border-border bg-surface rounded-sm p-4">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-1">
                HÁBITOS – STREAK MÁX
              </span>
              <span className="text-xl font-mono font-semibold text-health block">
                {kpis.maxStreak}d
              </span>
              <span className="text-[10px] font-mono text-on-surface/30 block mt-1">
                {kpis.activeHabits} ativos
              </span>
            </div>
          </div>

          {/* Weekly Task Trend — Simple HTML Bars */}
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
                <span className="inline-block w-2 h-2 rounded-sm bg-[#55D7ED]" />{" "}
                Concluídas
              </span>
              <span className="text-[9px] font-mono text-on-surface/30 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-[rgba(222,227,229,0.15)]" />{" "}
                Criadas
              </span>
            </div>
          </div>

          {/* Monthly Finance Trend — Simple HTML Bars */}
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
                <span className="inline-block w-2 h-2 rounded-sm bg-[#55D7ED]" />{" "}
                Receita
              </span>
              <span className="text-[9px] font-mono text-on-surface/30 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-[#FFB4AB]" />{" "}
                Despesa
              </span>
            </div>
          </div>

          {/* Habit Heatmap */}
          {activeHabitList.length > 0 && (
            <div className="border border-border bg-surface rounded-sm p-4 overflow-x-auto">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
                HÁBITOS – ÚLTIMOS 14 DIAS
              </span>
              <div className="min-w-max">
                <div
                  className="grid gap-x-1"
                  style={{
                    gridTemplateColumns: `100px repeat(${heatmapDays.length}, minmax(20px, 1fr))`,
                  }}
                >
                  <div className="text-[9px] font-mono text-on-surface/20" />
                  {heatmapDays.map((day) => (
                    <div
                      key={day.dateStr}
                      className="text-center text-[8px] font-mono text-on-surface/20 pb-1"
                    >
                      {day.label}
                    </div>
                  ))}

                  {activeHabitList.map((habit: any) => (
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
        </main>
      </div>
    </SectionErrorBoundary>
  )
}
