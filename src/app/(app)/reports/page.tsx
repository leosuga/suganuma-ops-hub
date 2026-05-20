"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { PeriodFilter } from "@/components/reports/PeriodFilter"
import { ReportsKPIs } from "@/components/reports/ReportsKPIs"
import { TaskTrendSection, FinanceTrendSection } from "@/components/reports/TrendSections"
import { HabitHeatmap } from "@/components/reports/HabitHeatmap"

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

function buildEntryKey(habitId: string, dateStr: string) {
  return `${habitId}::${dateStr}`
}

export default function ReportsPage() {
  useTitle("Reports \u00b7 Suganuma Ops Hub")

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
    entrySet.add(buildEntryKey(e.habit_id, new Date(e.done_on).toDateString()))
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

        <ReportsKPIs
          rate={rate}
          done={done}
          total={total}
          overdue={overdue}
          balance={inc - exp}
          income={inc}
          expense={exp}
          maxStreak={maxStreak}
          activeHabits={activeHabits.length}
          fmt={fmt}
        />

        <TaskTrendSection data={taskTrendData} />
        <FinanceTrendSection data={financeTrendData} />

        <HabitHeatmap
          habits={activeHabits}
          heatmapDays={heatmapDays}
          entrySet={entrySet}
          buildEntryKey={buildEntryKey}
        />
      </div>
    </SectionErrorBoundary>
  )
}
