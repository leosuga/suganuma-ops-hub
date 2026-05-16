"use client"

import { useMemo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { useReports } from "@/lib/queries/reports"
import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"

/* ────────────────────────────────────────────────
   Helpers
─────────────────────────────────────────────────── */

function formatCurrency(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

function startOfWeek(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1) // Monday as start
  return new Date(date.setDate(diff))
}

function isoWeekKey(d: Date) {
  const s = startOfWeek(d)
  return `${String(s.getDate()).padStart(2, "0")}/${String(s.getMonth() + 1).padStart(2, "0")}`
}

function addDays(d: Date, days: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

/* ── Tooltip components ── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function TasksTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-sm px-3 py-2 text-[10px] font-mono">
      <p className="text-on-surface/40 mb-1">Semana {label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "completed" ? "Concluídas" : "Criadas"}: {p.value}
        </p>
      ))}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function FinanceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-sm px-3 py-2 text-[10px] font-mono">
      <p className="text-on-surface/40 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "income" ? "Receita" : "Despesa"}: {formatCurrency(p.value)}
        </p>
      ))}
    </div>
  )
}

/* ────────────────────────────────────────────────
   Page component
─────────────────────────────────────────────────── */

export default function ReportsPage() {
  useTitle("Reports · Suganuma Ops Hub")
  const { data, isLoading } = useReports()

  const tasks = data?.tasks ?? []
  const transactions = data?.transactions ?? []
  const habits = data?.habits ?? []
  const entries = data?.entries ?? []

  const today = useMemo(() => new Date(), [])

  /* ── KPIs ── */
  const kpis = useMemo(() => {
    const totalTasks = tasks.length
    const completedTasks = tasks.filter((t) => t.completed_at != null).length
    const overdueTasks = tasks.filter(
      (t) => !t.completed_at && t.due_at && new Date(t.due_at) < new Date()
    ).length
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

    const income = transactions
      .filter((t) => t.kind === "income")
      .reduce((s, t) => s + Number(t.amount), 0)
    const expense = transactions
      .filter((t) => t.kind === "expense" || t.kind === "tax")
      .reduce((s, t) => s + Number(t.amount), 0)
    const netBalance = income - expense

    const activeHabits = habits.filter((h) => h.active).length

    // Best streak (for any habit) – longest consecutive run ending at/before today
    const normalizedToday = new Date(today)
    normalizedToday.setHours(0, 0, 0, 0)
    let maxStreak = 0
    for (const habit of habits) {
      const habitEntries = entries
        .filter((e) => e.habit_id === habit.id)
        .map((e) => new Date(e.done_on).toDateString())
      const uniqueDays = Array.from(new Set(habitEntries)).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime()
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

  /* ── Weekly task trend (last 8 weeks) ── */
  const taskTrendData = useMemo(() => {
    const weeks: { label: string; completed: number; created: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const weekStart = addDays(startOfWeek(today), -i * 7)
      const weekEnd = addDays(weekStart, 7)
      const label = isoWeekKey(weekStart)
      const completed = tasks.filter((t) => {
        if (!t.completed_at) return false
        const d = new Date(t.completed_at)
        return d >= weekStart && d < weekEnd
      }).length
      const created = tasks.filter((t) => {
        const d = new Date(t.created_at)
        return d >= weekStart && d < weekEnd
      }).length
      weeks.push({ label, completed, created })
    }
    return weeks
  }, [tasks, today])

  /* ── Monthly finance trend (last 6 months) ── */
  const financeTrendData = useMemo(() => {
    const months: { label: string; income: number; expense: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
      const inc = transactions
        .filter((t) => t.kind === "income" && t.occurred_on?.startsWith(ym))
        .reduce((s, t) => s + Number(t.amount), 0)
      const exp = transactions
        .filter((t) => (t.kind === "expense" || t.kind === "tax") && t.occurred_on?.startsWith(ym))
        .reduce((s, t) => s + Number(t.amount), 0)
      months.push({ label: label.charAt(0).toUpperCase() + label.slice(1), income: inc, expense: exp })
    }
    return months
  }, [transactions, today])

  /* ── Habit heatmap (last 14 days) ── */
  const heatmapDays = useMemo(() => {
    const days: { dateStr: string; label: string }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = addDays(today, -i)
      days.push({
        dateStr: d.toDateString(),
        label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      })
    }
    return days
  }, [today])

  const activeHabitList = useMemo(() => habits.filter((h) => h.active), [habits])

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
          <div className="h-40 bg-surface rounded-sm border border-border" />
          <div className="h-40 bg-surface rounded-sm border border-border" />
        </div>
      </SectionErrorBoundary>
    )
  }

  return (
    <SectionErrorBoundary label="REPORTS">
      <div className="p-4 space-y-6">
        {/* Header */}
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
            <span className={`text-xl font-mono font-semibold block ${kpis.overdueTasks > 0 ? "text-danger" : "text-on-surface"}`}>
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
            <span className={`text-xl font-mono font-semibold block ${kpis.netBalance >= 0 ? "text-teal" : "text-danger"}`}>
              {formatCurrency(kpis.netBalance)}
            </span>
            <span className="text-[10px] font-mono text-on-surface/30 block mt-1">
              {formatCurrency(kpis.income)} rec / {formatCurrency(kpis.expense)} desp
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

        {/* Weekly Task Trend */}
        <div className="border border-border bg-surface rounded-sm p-4">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
            TASKS – CONCLUÍDAS POR SEMANA
          </span>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={taskTrendData} barCategoryGap="20%">
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fontFamily: "ui-monospace", fill: "rgba(222,227,229,0.3)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<TasksTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Legend
                content={() => (
                  <div className="flex gap-4 justify-center mt-2">
                    <span className="text-[9px] font-mono text-on-surface/30 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: "#55D7ED" }} />
                      Concluídas
                    </span>
                    <span className="text-[9px] font-mono text-on-surface/30 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: "rgba(222,227,229,0.15)" }} />
                      Criadas
                    </span>
                  </div>
                )}
              />
              <Bar dataKey="completed" fill="#55D7ED" radius={[2, 2, 0, 0]} />
              <Bar dataKey="created" fill="rgba(222,227,229,0.15)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Monthly Finance Trend */}
        <div className="border border-border bg-surface rounded-sm p-4">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
            FINANCEIRO – FLUXO MENSAL
          </span>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={financeTrendData} barCategoryGap="20%">
              <XAxis
                dataKey="label"
                tick={{ fontSize: 9, fontFamily: "ui-monospace", fill: "rgba(222,227,229,0.3)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip content={<FinanceTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Legend
                content={() => (
                  <div className="flex gap-4 justify-center mt-2">
                    <span className="text-[9px] font-mono text-on-surface/30 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: "#55D7ED" }} />
                      Receita
                    </span>
                    <span className="text-[9px] font-mono text-on-surface/30 flex items-center gap-1">
                      <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: "#FFB4AB" }} />
                      Despesa
                    </span>
                  </div>
                )}
              />
              <Bar dataKey="income" fill="#55D7ED" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expense" fill="#FFB4AB" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
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
                style={{ gridTemplateColumns: `100px repeat(${heatmapDays.length}, minmax(20px, 1fr))` }}
              >
                {/* Header row */}
                <div className="text-[9px] font-mono text-on-surface/20" />
                {heatmapDays.map((day) => (
                  <div key={day.dateStr} className="text-center text-[8px] font-mono text-on-surface/20 pb-1">
                    {day.label}
                  </div>
                ))}

                {/* Habit rows */}
                {activeHabitList.map((habit) => (
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
                                ? (habit.color || "var(--color-health)")
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
