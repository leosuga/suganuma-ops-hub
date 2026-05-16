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
        <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
          REPORTS
        </h1>

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

        <div className="border border-border bg-surface rounded-sm p-4 h-32 flex items-center justify-center">
          <span className="text-[10px] font-mono text-on-surface/20">
            Gráficos em breve (KPIs ok)
          </span>
        </div>
      </div>
    </SectionErrorBoundary>
  )
}
