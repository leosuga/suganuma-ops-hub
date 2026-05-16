import { useMemo } from "react"
import { useQuery, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { TaskRow } from "@/lib/queries/tasks"
import type { TransactionRow } from "@/lib/queries/finance"
import type { HabitTrackRow, HabitEntryRow } from "@/lib/queries/habits"

export const reportsKeys = {
  all: ["reports"] as const,
}

export interface ReportData {
  tasks: TaskReport
  finance: FinanceReport
  habits: HabitReport
  dateRange: { from: string; to: string }
}

export interface TaskReport {
  total: number
  done: number
  pending: number
  overdue: number
  urgent: number
  byCategory: Record<"finance" | "logistics" | "personal" | "health", { total: number; done: number; pending: number }>
  byPriority: Record<"low" | "med" | "high" | "urgent", number>
  completionRate: number
  weeklyTrend: { week: string; done: number; created: number }[]
}

export interface FinanceReport {
  totalIncome: number
  totalExpense: number
  balance: number
  byCategory: Record<string, { income: number; expense: number }>
  monthlyTrend: { month: string; income: number; expense: number; balance: number }[]
  dailyAverage: { income: number; expense: number }
}

export interface HabitReport {
  active: number
  totalEntries: number
  streaks: { habitId: string; name: string; streak: number; best: number }[]
  weeklyHeatmap: { day: string; count: number }[]
}

// ── Helpers ─────────────────────────────────────────────────

function getWeekStart(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

function buildTaskReport(tasks: TaskRow[]): TaskReport {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const done = tasks.filter((t) => t.status === "done")
  const pending = tasks.filter((t) => t.status !== "done" && t.status !== "archived")
  const overdue = pending.filter((t) => t.due_at && t.due_at.slice(0, 10) < today)
  const urgent = pending.filter((t) => t.priority === "urgent")

  const byCategory: Record<"finance" | "logistics" | "personal" | "health", { total: number; done: number; pending: number }> = {
    finance: { total: 0, done: 0, pending: 0 },
    logistics: { total: 0, done: 0, pending: 0 },
    personal: { total: 0, done: 0, pending: 0 },
    health: { total: 0, done: 0, pending: 0 },
  }

  for (const cat of ["finance", "logistics", "personal", "health"] as const) {
    const catTasks = tasks.filter((t) => t.category === cat)
    byCategory[cat] = {
      total: catTasks.length,
      done: catTasks.filter((t) => t.status === "done").length,
      pending: catTasks.filter((t) => t.status !== "done").length,
    }
  }

  const byPriority: Record<"low" | "med" | "high" | "urgent", number> = {
    low: 0, med: 0, high: 0, urgent: 0,
  }
  for (const t of tasks) {
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1
  }

  const weeks: { week: string; done: number; created: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const weekStart = getWeekStart(d)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekEndStr = weekEnd.toISOString().slice(0, 10) + "T23:59:59"
    const weekStr = weekStart.toISOString().slice(0, 10)

    const doneThisWeek = tasks.filter(
      (t) =>
        t.status === "done" &&
        t.completed_at &&
        t.completed_at >= weekStr &&
        t.completed_at <= weekEndStr
    ).length

    const createdThisWeek = tasks.filter(
      (t) => t.created_at >= weekStr && t.created_at <= weekEndStr
    ).length

    weeks.push({ week: weekStr.slice(5), done: doneThisWeek, created: createdThisWeek })
  }

  return {
    total: tasks.length,
    done: done.length,
    pending: pending.length,
    overdue: overdue.length,
    urgent: urgent.length,
    byCategory,
    byPriority,
    completionRate: tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0,
    weeklyTrend: weeks,
  }
}

function buildFinanceReport(transactions: TransactionRow[]): FinanceReport {
  const income = transactions.filter((t) => t.kind === "income")
  const expense = transactions.filter((t) => t.kind === "expense" || t.kind === "tax")
  const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = expense.reduce((s, t) => s + Number(t.amount), 0)

  const byCategory: Record<string, { income: number; expense: number }> = {}
  for (const t of transactions) {
    const cat = t.category ?? "uncategorized"
    if (!byCategory[cat]) byCategory[cat] = { income: 0, expense: 0 }
    if (t.kind === "income") {
      byCategory[cat].income += Number(t.amount)
    } else {
      byCategory[cat].expense += Number(t.amount)
    }
  }

  const months: { month: string; income: number; expense: number; balance: number }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const monthStr = `${y}-${m}`
    const from = `${monthStr}-01`
    const to =
      d.getMonth() === 11
        ? `${y + 1}-01-01`
        : `${y}-${String(d.getMonth() + 2).padStart(2, "0")}-01`

    const monthIncome = income
      .filter((t) => t.occurred_on >= from && t.occurred_on < to)
      .reduce((s, t) => s + Number(t.amount), 0)
    const monthExpense = expense
      .filter((t) => t.occurred_on >= from && t.occurred_on < to)
      .reduce((s, t) => s + Number(t.amount), 0)

    months.push({
      month: `${m}/${y}`,
      income: monthIncome,
      expense: monthExpense,
      balance: monthIncome - monthExpense,
    })
  }

  const last30 = new Date(now)
  last30.setDate(last30.getDate() - 30)
  const last30Str = last30.toISOString().slice(0, 10)
  const recentIncome = income
    .filter((t) => t.occurred_on >= last30Str)
    .reduce((s, t) => s + Number(t.amount), 0)
  const recentExpense = expense
    .filter((t) => t.occurred_on >= last30Str)
    .reduce((s, t) => s + Number(t.amount), 0)

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byCategory,
    monthlyTrend: months,
    dailyAverage: {
      income: Math.round(recentIncome / 30),
      expense: Math.round(recentExpense / 30),
    },
  }
}

function buildHabitReport(habits: HabitTrackRow[], entries: HabitEntryRow[]): HabitReport {
  const active = habits.filter((h) => h.active).length

  const streaks = habits.map((h) => {
    const habitEntries = entries
      .filter((e) => e.habit_id === h.id)
      .map((e) => e.done_on)
      .sort()

    let bestStreak = 0
    let tempStreak = 0
    let prevDate: Date | null = null

    for (const dateStr of habitEntries) {
      const d = new Date(dateStr)
      if (prevDate) {
        const diff = Math.round((d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diff === 1) {
          tempStreak++
        } else if (diff > 1) {
          bestStreak = Math.max(bestStreak, tempStreak)
          tempStreak = 1
        }
      } else {
        tempStreak = 1
      }
      prevDate = d
    }
    bestStreak = Math.max(bestStreak, tempStreak)

    // Current streak
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let checkDate = new Date(today)
    let currentStreak = 0
    const entrySet = new Set(habitEntries)

    while (true) {
      const checkStr = checkDate.toISOString().slice(0, 10)
      if (entrySet.has(checkStr)) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else if (currentStreak === 0) {
        checkDate.setDate(checkDate.getDate() - 1)
        const oldest = habitEntries[0] ?? "1970-01-01"
        if (checkDate < new Date(oldest)) break
      } else {
        break
      }
    }

    return {
      habitId: h.id,
      name: h.name,
      streak: currentStreak,
      best: bestStreak,
    }
  })

  const heatmap: { day: string; count: number }[] = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dayStr = d.toISOString().slice(0, 10)
    const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })
    const count = entries.filter((e) => e.done_on === dayStr).length
    heatmap.push({ day: dayLabel, count })
  }

  return {
    active,
    totalEntries: entries.length,
    streaks,
    weeklyHeatmap: heatmap,
  }
}

// ── Query ─────────────────────────────────────────────────────

export const reportsOptions = queryOptions({
  queryKey: reportsKeys.all,
  queryFn: async (): Promise<ReportData> {
    const supabase = createClient()

    // Fetch all data in parallel via Supabase (RLS filters by owner)
    const [
      { data: tasksData, error: tasksError },
      { data: txnData, error: txnError },
      { data: habitsData, error: habitsError },
      { data: entriesData, error: entriesError },
    ] = await Promise.all([
      supabase
        .from("task")
        .select("*")
        .neq("status", "archived")
        .order("created_at", { ascending: false }),
      supabase
        .from("transaction")
        .select("*")
        .order("occurred_on", { ascending: false }),
      supabase
        .from("habit_track")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("habit_entry")
        .select("*")
        .order("done_on", { ascending: true })
        .limit(1000),
    ])

    if (tasksError) throw tasksError
    if (txnError) throw txnError
    if (habitsError) throw habitsError
    if (entriesError) throw entriesError

    const tasks = (tasksData ?? []) as TaskRow[]
    const transactions = (txnData ?? []) as TransactionRow[]
    const habits = (habitsData ?? []) as HabitTrackRow[]
    const entries = (entriesData ?? []) as HabitEntryRow[]

    const taskReport = buildTaskReport(tasks)
    const financeReport = buildFinanceReport(transactions)
    const habitReport = buildHabitReport(habits, entries)

    const dates = tasks.map((t) => t.created_at).filter(Boolean)
    const oldest = dates.length > 0 ? dates.sort()[0] : new Date().toISOString()

    return {
      tasks: taskReport,
      finance: financeReport,
      habits: habitReport,
      dateRange: {
        from: oldest,
        to: new Date().toISOString(),
      },
    }
  },
})

export function useReports() {
  return useQuery(reportsOptions)
}

export interface FinanceReport {
  totalIncome: number
  totalExpense: number
  balance: number
  byCategory: Record<string, { income: number; expense: number }>
  monthlyTrend: { month: string; income: number; expense: number; balance: number }[]
  dailyAverage: { income: number; expense: number }
}

export interface HabitReport {
  active: number
  totalEntries: number
  streaks: { habitId: string; name: string; streak: number; best: number }[]
  weeklyHeatmap: { day: string; count: number }[]
}

export interface ReportData {
  tasks: TaskReport
  finance: FinanceReport
  habits: HabitReport
  dateRange: { from: string; to: string }
}

// ── Helpers ─────────────────────────────────────────────────

function getWeekStart(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

function buildTaskReport(tasks: TaskRow[]): TaskReport {
  const now = new Date()
  const today = now.toISOString().slice(0, 10)

  const done = tasks.filter((t) => t.status === "done")
  const pending = tasks.filter((t) => t.status !== "done" && t.status !== "archived")
  const overdue = pending.filter((t) => t.due_at && t.due_at.slice(0, 10) < today)
  const urgent = pending.filter((t) => t.priority === "urgent")

  const byCategory: Record<"finance" | "logistics" | "personal" | "health", { total: number; done: number; pending: number }> = {
    finance: { total: 0, done: 0, pending: 0 },
    logistics: { total: 0, done: 0, pending: 0 },
    personal: { total: 0, done: 0, pending: 0 },
    health: { total: 0, done: 0, pending: 0 },
  }

  for (const cat of ["finance", "logistics", "personal", "health"] as const) {
    const catTasks = tasks.filter((t) => t.category === cat)
    byCategory[cat] = {
      total: catTasks.length,
      done: catTasks.filter((t) => t.status === "done").length,
      pending: catTasks.filter((t) => t.status !== "done").length,
    }
  }

  const byPriority: Record<"low" | "med" | "high" | "urgent", number> = {
    low: 0, med: 0, high: 0, urgent: 0,
  }
  for (const t of tasks) {
    byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1
  }

  const weeks: { week: string; done: number; created: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    const weekStart = getWeekStart(d)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekEndStr = weekEnd.toISOString().slice(0, 10) + "T23:59:59"
    const weekStr = weekStart.toISOString().slice(0, 10)

    const doneThisWeek = tasks.filter(
      (t) =>
        t.status === "done" &&
        t.completed_at &&
        t.completed_at >= weekStr &&
        t.completed_at <= weekEndStr
    ).length

    const createdThisWeek = tasks.filter(
      (t) => t.created_at >= weekStr && t.created_at <= weekEndStr
    ).length

    weeks.push({ week: weekStr.slice(5), done: doneThisWeek, created: createdThisWeek })
  }

  return {
    total: tasks.length,
    done: done.length,
    pending: pending.length,
    overdue: overdue.length,
    urgent: urgent.length,
    byCategory,
    byPriority,
    completionRate: tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0,
    weeklyTrend: weeks,
  }
}

function buildFinanceReport(transactions: TransactionRow[]): FinanceReport {
  const income = transactions.filter((t) => t.kind === "income")
  const expense = transactions.filter((t) => t.kind === "expense" || t.kind === "tax")
  const totalIncome = income.reduce((s, t) => s + Number(t.amount), 0)
  const totalExpense = expense.reduce((s, t) => s + Number(t.amount), 0)

  const byCategory: Record<string, { income: number; expense: number }> = {}
  for (const t of transactions) {
    const cat = t.category ?? "uncategorized"
    if (!byCategory[cat]) byCategory[cat] = { income: 0, expense: 0 }
    if (t.kind === "income") {
      byCategory[cat].income += Number(t.amount)
    } else {
      byCategory[cat].expense += Number(t.amount)
    }
  }

  const months: { month: string; income: number; expense: number; balance: number }[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const monthStr = `${y}-${m}`
    const from = `${monthStr}-01`
    const to =
      d.getMonth() === 11
        ? `${y + 1}-01-01`
        : `${y}-${String(d.getMonth() + 2).padStart(2, "0")}-01`

    const monthIncome = income
      .filter((t) => t.occurred_on >= from && t.occurred_on < to)
      .reduce((s, t) => s + Number(t.amount), 0)
    const monthExpense = expense
      .filter((t) => t.occurred_on >= from && t.occurred_on < to)
      .reduce((s, t) => s + Number(t.amount), 0)

    months.push({
      month: `${m}/${y}`,
      income: monthIncome,
      expense: monthExpense,
      balance: monthIncome - monthExpense,
    })
  }

  const last30 = new Date(now)
  last30.setDate(last30.getDate() - 30)
  const last30Str = last30.toISOString().slice(0, 10)
  const recentIncome = income
    .filter((t) => t.occurred_on >= last30Str)
    .reduce((s, t) => s + Number(t.amount), 0)
  const recentExpense = expense
    .filter((t) => t.occurred_on >= last30Str)
    .reduce((s, t) => s + Number(t.amount), 0)

  return {
    totalIncome,
    totalExpense,
    balance: totalIncome - totalExpense,
    byCategory,
    monthlyTrend: months,
    dailyAverage: {
      income: Math.round(recentIncome / 30),
      expense: Math.round(recentExpense / 30),
    },
  }
}

function buildHabitReport(habits: HabitTrackRow[], entries: HabitEntryRow[]): HabitReport {
  const active = habits.filter((h) => h.active).length

  const streaks = habits.map((h) => {
    const habitEntries = entries
      .filter((e) => e.habit_id === h.id)
      .map((e) => e.done_on)
      .sort()

    let bestStreak = 0
    let tempStreak = 0
    let prevDate: Date | null = null

    for (const dateStr of habitEntries) {
      const d = new Date(dateStr)
      if (prevDate) {
        const diff = Math.round((d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24))
        if (diff === 1) {
          tempStreak++
        } else if (diff > 1) {
          bestStreak = Math.max(bestStreak, tempStreak)
          tempStreak = 1
        }
      } else {
        tempStreak = 1
      }
      prevDate = d
    }
    bestStreak = Math.max(bestStreak, tempStreak)

    // Current streak
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let checkDate = new Date(today)
    let currentStreak = 0
    const entrySet = new Set(habitEntries)

    while (true) {
      const checkStr = checkDate.toISOString().slice(0, 10)
      if (entrySet.has(checkStr)) {
        currentStreak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else if (currentStreak === 0) {
        checkDate.setDate(checkDate.getDate() - 1)
        const oldest = habitEntries[0] ?? "1970-01-01"
        if (checkDate < new Date(oldest)) break
      } else {
        break
      }
    }

    return {
      habitId: h.id,
      name: h.name,
      streak: currentStreak,
      best: bestStreak,
    }
  })

  const heatmap: { day: string; count: number }[] = []
  const now = new Date()
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const dayStr = d.toISOString().slice(0, 10)
    const dayLabel = d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" })
    const count = entries.filter((e) => e.done_on === dayStr).length
    heatmap.push({ day: dayLabel, count })
  }

  return {
    active,
    totalEntries: entries.length,
    streaks,
    weeklyHeatmap: heatmap,
  }
}

// ── Query ───────────────────────────────────────────────────

export const reportsKeys = {
  all: ["reports"] as const,
}

export const reportsOptions = queryOptions({
  queryKey: reportsKeys.all,
  queryFn: async (): Promise<ReportData> {
    const supabase = createClient()

    // Fetch all data in parallel
    const [
      { data: tasksData, error: tasksError },
      { data: txnData, error: txnError },
      { data: habitsData, error: habitsError },
      { data: entriesData, error: entriesError },
    ] = await Promise.all([
      supabase
        .from("task")
        .select("*")
        .neq("status", "archived")
        .order("created_at", { ascending: false }),
      supabase
        .from("transaction")
        .select("*")
        .order("occurred_on", { ascending: false }),
      supabase
        .from("habit_track")
        .select("*")
        .order("created_at", { ascending: true }),
      supabase
        .from("habit_entry")
        .select("*")
        .order("done_on", { ascending: true })
        .limit(1000),
    ])

    if (tasksError) throw tasksError
    if (txnError) throw txnError
    if (habitsError) throw habitsError
    if (entriesError) throw entriesError

    const tasks = (tasksData ?? []) as TaskRow[]
    const transactions = (txnData ?? []) as TransactionRow[]
    const habits = (habitsData ?? []) as HabitTrackRow[]
    const entries = (entriesData ?? []) as HabitEntryRow[]

    const taskReport = buildTaskReport(tasks)
    const financeReport = buildFinanceReport(transactions)
    const habitReport = buildHabitReport(habits, entries)

    const dates = tasks.map((t) => t.created_at).filter(Boolean)
    const oldest = dates.length > 0 ? dates.sort()[0] : new Date().toISOString()

    return {
      tasks: taskReport,
      finance: financeReport,
      habits: habitReport,
      dateRange: {
        from: oldest,
        to: new Date().toISOString(),
      },
    }
  },
})

export function useReports() {
  return useQuery(reportsOptions)
}