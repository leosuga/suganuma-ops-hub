"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export default function ReportsPage() {
  useTitle("Reports · Suganuma Ops Hub")

  const [tasks, setTasks] = useState<any[]>([])
  const [transactions, setTransactions] = useState<any[]>([])
  const [habits, setHabits] = useState<any[]>([])
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from("task").select("completed_at, due_at").neq("status", "archived"),
      supabase.from("transaction").select("kind, amount"),
      supabase.from("habit_track").select("active"),
      supabase.from("habit_entry").select("habit_id, done_on").limit(500),
    ]).then(([t, tr, h, e]) => {
      setTasks(t.data ?? [])
      setTransactions(tr.data ?? [])
      setHabits(h.data ?? [])
      setEntries(e.data ?? [])
      setLoading(false)
    })
  }, [])

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
        </div>
      </SectionErrorBoundary>
    )
  }

  const total = tasks.length
  const done = tasks.filter((t: any) => t.completed_at).length
  const rate = total > 0 ? Math.round((done / total) * 100) : 0
  const overdue = tasks.filter(
    (t: any) => !t.completed_at && t.due_at && new Date(t.due_at) < new Date()
  ).length

  const inc = transactions
    .filter((t: any) => t.kind === "income")
    .reduce((s: number, t: any) => s + Number(t.amount), 0)
  const exp = transactions
    .filter((t: any) => t.kind === "expense" || t.kind === "tax")
    .reduce((s: number, t: any) => s + Number(t.amount), 0)

  const active = habits.filter((h: any) => h.active).length

  // Simple streak calc (max streak across all habits)
  let maxStreak = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
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
      </div>
    </SectionErrorBoundary>
  )
}
