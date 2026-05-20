"use client"

import { useState } from "react"
import Link from "next/link"
import { useTasks } from "@/lib/queries/tasks"
import { useTransactions } from "@/lib/queries/finance"
import { useTitle } from "@/lib/useTitle"
import { useAppointments, usePregnancy, useCreateHealthLog } from "@/lib/queries/health"
import { useMealPlans } from "@/lib/queries/meals"
import { useNotes } from "@/lib/queries/notes"
import { useProjects } from "@/lib/queries/projects"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { StatCard } from "@/components/dashboard/StatCard"
import { ProtocolsSummary } from "@/components/dashboard/ProtocolsSummary"
import { QuickAddTask } from "@/components/dashboard/QuickAddTask"
import { QuickAddExpense } from "@/components/dashboard/QuickAddExpense"
import { DailyBriefing } from "@/components/dashboard/DailyBriefing"
import { NeedsAttention } from "@/components/dashboard/NeedsAttention"
import { TaskKPIs } from "@/components/dashboard/TaskKPIs"
import { EisenhowerMatrix } from "@/components/dashboard/EisenhowerMatrix"
import type { TaskRow } from "@/lib/queries/tasks"

function weeksFromDueDate(dueDate: string): number {
  const due = new Date(dueDate)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const weeksLeft = diffMs / (7 * 24 * 60 * 60 * 1000)
  return Math.max(0, Math.round(40 - weeksLeft))
}

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

export default function DashboardPage() {
  useTitle("Dashboard · Suganuma Ops Hub")
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: transactions = [], isLoading: financeLoading } = useTransactions({ month: currentMonth() })
  const { data: appointments = [] } = useAppointments()
  const { data: pregnancy } = usePregnancy()
  const createHealthLog = useCreateHealthLog()
  const { data: notes = [] } = useNotes()
  const { data: mealPlans = [] } = useMealPlans(currentMonth())
  const { data: projects = [] } = useProjects()

  const [weightInput, setWeightInput] = useState("")

  const pending = tasks.filter((t) => t.status === "todo" || t.status === "doing")
  const done = tasks.filter((t) => t.status === "done")
  const urgent = pending.filter((t) => t.priority === "urgent")
  const overdue = pending.filter((t) => t.due_at && new Date(t.due_at) < new Date())
  const needsAttention = urgent.length > 0 ? urgent : overdue.length > 0 ? overdue : pending.slice(0, 3)

  const income = transactions.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0)
  const expense = transactions.filter((t) => t.kind === "expense" || t.kind === "tax").reduce((s, t) => s + Number(t.amount), 0)
  const balance = income - expense

  const now = new Date()
  const upcomingAppts = appointments
    .filter((a) => new Date(a.starts_at) >= now)
    .slice(0, 3)

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayMeals = mealPlans.filter((mp) => mp.date === todayStr)
  const todayNotes = notes.filter((n) => n.pinned).slice(0, 2)
  const todayAppts = appointments.filter((a) => a.starts_at.slice(0, 10) === todayStr)

  const isLoading = tasksLoading || financeLoading

  async function handleQuickWeight(e: React.FormEvent) {
    e.preventDefault()
    const kg = parseFloat(weightInput.replace(",", "."))
    if (!kg) return
    await createHealthLog.mutateAsync({ kind: "weight", value: { kg } })
    setWeightInput("")
  }

  return (
    <SectionErrorBoundary label="DASHBOARD">
      <div className="p-4 space-y-5">
        <div>
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
            SUGANUMA OPS HUB
          </h1>
          <p className="text-[10px] font-mono text-on-surface/30 mt-0.5 capitalize">
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </p>
        </div>

        <QuickAddTask />
        <QuickAddExpense />

        <DailyBriefing
          pendingCount={pending.length}
          doneCount={done.length}
          urgentCount={urgent.length}
          todayAppts={todayAppts}
          todayMeals={todayMeals}
          todayNotes={todayNotes}
        />

        <form onSubmit={handleQuickWeight} className="border border-border bg-surface rounded-sm overflow-hidden">
          <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">
              PESO HOJE
            </span>
            <Link href="/health" className="ml-auto text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">
              HEALTH →
            </Link>
          </div>
          <div className="flex items-center gap-2 px-4 py-2">
            <input
              type="text" inputMode="decimal"
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              placeholder="68.5 kg"
              className="flex-1 h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-health transition-colors"
            />
            <button
              type="submit"
              disabled={!weightInput || createHealthLog.isPending}
              className="h-8 px-3 bg-health/10 border border-health text-health font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-health/20 disabled:opacity-30 transition-colors flex-none"
            >
              {createHealthLog.isPending ? "..." : "SALVAR"}
            </button>
          </div>
        </form>

        <NeedsAttention tasks={needsAttention} urgentCount={urgent.length} />

        {urgent.length > 0 && (
          <div className="border border-danger/40 bg-danger/5 rounded-sm px-4 py-2.5 flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse flex-none" />
            <span className="text-[11px] font-mono text-danger">
              {urgent.length} {urgent.length === 1 ? "task urgente" : "tasks urgentes"} pendente{urgent.length > 1 ? "s" : ""}
            </span>
          </div>
        )}
        {overdue.length > 0 && (
          <div className="border border-amber/40 bg-amber/5 rounded-sm px-4 py-2.5 flex items-center gap-3">
            <div className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse flex-none" />
            <span className="text-[11px] font-mono text-amber">
              {overdue.length} {overdue.length === 1 ? "task atrasada" : "tasks atrasadas"}
            </span>
          </div>
        )}

        <TaskKPIs
          pending={pending.length}
          done={done.length}
          urgent={urgent.length}
          overdue={overdue.length}
          isLoading={isLoading}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Saldo mês" value={fmt(balance)} sub={financeLoading ? "..." : `${transactions.length} transações`} color={balance >= 0 ? "text-teal" : "text-danger"} />
          <StatCard label="Despesas" value={fmt(expense)} sub="mês atual" color={expense > 0 ? "text-danger" : "text-on-surface"} />
          {pregnancy?.due_date && (
            <StatCard label="Semana" value={weeksFromDueDate(pregnancy.due_date)} sub="de gestação" color="text-health" />
          )}
          <ProtocolsSummary />
        </div>

        {upcomingAppts.length > 0 && (
          <div className="border border-border bg-surface rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
                PRÓXIMAS CONSULTAS
              </span>
              <Link href="/health" className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors">
                VER TODAS →
              </Link>
            </div>
            <div className="divide-y divide-border">
              {upcomingAppts.map((a) => {
                const date = new Date(a.starts_at)
                const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
                const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
                return (
                  <div key={a.id} className="flex items-center gap-3 h-10 px-4">
                    <span className="text-[10px] font-mono text-health w-16 flex-none">{dateStr} {timeStr}</span>
                    <span className="flex-1 text-[12px] font-mono text-on-surface truncate">{a.title}</span>
                    {a.location && <span className="text-[10px] font-mono text-on-surface/30 truncate max-w-[100px]">{a.location}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {projects.filter((p) => p.status === "active").length > 0 && (
          <div className="border border-border bg-surface rounded-sm">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
                PROJETOS ATIVOS
              </span>
              <Link href="/projects" className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors">
                VER TODOS →
              </Link>
            </div>
            <div className="divide-y divide-border">
              {projects.filter((p) => p.status === "active").map((project) => {
                const total = tasks.filter((t) => t.project_id === project.id).length
                const doneTasks = tasks.filter((t) => t.project_id === project.id && t.status === "done").length
                const pct = total > 0 ? Math.round((doneTasks / total) * 100) : 0
                return (
                  <div key={project.id} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: project.color }} />
                      <Link href={`/tasks?project=${project.id}`} className="text-[11px] font-mono text-on-surface/60 hover:text-teal transition-colors">
                        {project.name}
                      </Link>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-20 h-1.5 bg-bg rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: project.color }} />
                      </div>
                      <span className="text-[10px] font-mono text-on-surface/30 w-10 text-right">{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <EisenhowerMatrix pending={pending} projects={projects} />

        <div className="border border-border bg-surface rounded-sm">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              TASKS POR CATEGORIA
            </span>
            <Link href="/tasks" className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors">
              VER TASKS →
            </Link>
          </div>
          <div className="divide-y divide-border">
            {(["finance", "logistics", "personal", "health"] as const).map((cat) => {
              const count = pending.filter((t) => t.category === cat).length
              return (
                <div key={cat} className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-on-surface/60 uppercase tracking-wider">{cat}</span>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 bg-teal/30 rounded-full" style={{ width: `${Math.max(4, count * 12)}px` }} />
                    <span className="text-[12px] font-mono text-on-surface w-5 text-right">{count}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </SectionErrorBoundary>
  )
}
