"use client"

import { useState, useMemo, useEffect } from "react"
import Link from "next/link"
import { useTasks } from "@/lib/queries/tasks"
import { useTransactions } from "@/lib/queries/finance"
import { useTitle } from "@/lib/useTitle"
import { usePregnancy, useCreateHealthLog } from "@/lib/queries/health"
import { useNotes } from "@/lib/queries/notes"
import { useProjects } from "@/lib/queries/projects"
import { parseContextTags } from "@/lib/contexts"
import { currentMonth } from "@/lib/date"
import { fmtCurrency } from "@/lib/format"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { StatCard } from "@/components/dashboard/StatCard"
import { ProtocolsSummary } from "@/components/dashboard/ProtocolsSummary"
import { QuickAddTask } from "@/components/dashboard/QuickAddTask"
import { QuickAddExpense } from "@/components/dashboard/QuickAddExpense"
import { TaskKPIs } from "@/components/dashboard/TaskKPIs"
import { EisenhowerMatrix } from "@/components/dashboard/EisenhowerMatrix"
import { WeeklyReview } from "@/components/dashboard/WeeklyReview"
import { BudgetCard } from "@/components/dashboard/BudgetCard"
import { UpcomingEvents } from "@/components/dashboard/UpcomingEvents"
import { ContextNotesWidget } from "@/components/dashboard/ContextNotesWidget"

function weeksFromDueDate(dueDate: string): number {
  const due = new Date(dueDate)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const weeksLeft = diffMs / (7 * 24 * 60 * 60 * 1000)
  return Math.max(0, Math.round(40 - weeksLeft))
}

function fmt(n: number) {
  return fmtCurrency(n, { maximumFractionDigits: 0 })
}

const TASK_CATEGORIES = ["finance", "logistics", "personal", "health"] as const

export default function DashboardPage() {
  useTitle("Dashboard · Suganuma Ops Hub")
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: transactions = [], isLoading: financeLoading } = useTransactions({ month: currentMonth() })
  const { data: pregnancy } = usePregnancy()
  const createHealthLog = useCreateHealthLog()
  const { data: notes = [] } = useNotes()

  // Deferred queries: load after first paint to reduce initial waterfall.
  // These power below-the-fold sections (Eisenhower matrix, projects list).
  const [deferredReady, setDeferredReady] = useState(false)
  useEffect(() => {
    // Activate deferred queries on the next tick after mount
    const id = setTimeout(() => setDeferredReady(true), 0)
    return () => clearTimeout(id)
  }, [])

  const { data: projects = [] } = useProjects({ enabled: deferredReady })

  const [weightInput, setWeightInput] = useState("")

  const {
    pending,
    done,
    urgent,
    overdue,
    tasksByCategory,
    activeProjectsWithProgress,
  } = useMemo(() => {
    const pending = tasks.filter((t) => t.status === "todo" || t.status === "doing")
    const done = tasks.filter((t) => t.status === "done")
    const urgent = pending.filter((t) => t.priority === "urgent")
    const now = new Date()
    const overdue = pending.filter((t) => t.due_at && new Date(t.due_at) < now)

    const tasksByCategory = TASK_CATEGORIES.map((cat) => ({
      cat,
      count: pending.filter((t) => t.category === cat).length,
    }))

    const activeProjectsWithProgress = projects
      .filter((p) => p.status === "active")
      .map((project) => {
        const projectTasks = tasks.filter((t) => t.project_id === project.id)
        const total = projectTasks.length
        const doneTasks = projectTasks.filter((t) => t.status === "done").length
        const pct = total > 0 ? Math.round((doneTasks / total) * 100) : 0
        return { project, total, doneTasks, pct }
      })

    return { pending, done, urgent, overdue, tasksByCategory, activeProjectsWithProgress }
  }, [tasks, projects])

  const { income, expense, balance } = useMemo(() => {
    const income = transactions.filter((t) => t.kind === "income").reduce((s, t) => s + Number(t.amount), 0)
    const expense = transactions.filter((t) => t.kind === "expense" || t.kind === "tax").reduce((s, t) => s + Number(t.amount), 0)
    return { income, expense, balance: income - expense }
  }, [transactions])

  const uncategorizedCount = useMemo(
    () => notes.filter((n) => parseContextTags(n.tags).length === 0).length,
    [notes]
  )

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
        {isLoading && (
          <div className="space-y-5 animate-pulse">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-20 bg-surface rounded-sm border border-border" />
              ))}
            </div>
            <div className="h-44 bg-surface rounded-sm border border-border" />
            <div className="h-44 bg-surface rounded-sm border border-border" />
          </div>
        )}
        {!isLoading && (
        <div className="space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
              SUGANUMA OPS HUB
            </h1>
            <p className="text-[10px] font-mono text-on-surface/30 mt-0.5 capitalize">
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <Link
            href="/cockpit"
            className="text-[9px] font-mono text-on-surface/30 hover:text-teal transition-colors tracking-wider uppercase"
          >
            Cockpit →
          </Link>
        </div>

        <QuickAddTask />
        <QuickAddExpense />

        <ContextNotesWidget notes={notes} />

        {uncategorizedCount > 0 && (
          <Link
            href="/notes"
            className="flex items-center gap-2 px-4 py-3 border border-amber/30 bg-amber/5 rounded-sm hover:bg-amber/10 transition-colors"
          >
            <span className="text-[10px] font-mono text-amber">⚠</span>
            <span className="text-[11px] font-mono text-amber/80">
              {uncategorizedCount} {uncategorizedCount === 1 ? 'nota sem' : 'notas sem'} contexto
            </span>
            <span className="ml-auto text-[9px] font-mono text-amber/60 uppercase tracking-wider">
              Organizar →
            </span>
          </Link>
        )}

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

        <WeeklyReview tasks={tasks} />

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

        <BudgetCard income={income} expense={expense} />

        <UpcomingEvents />

        {activeProjectsWithProgress.length > 0 && (
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
              {activeProjectsWithProgress.map(({ project, total, pct }) => {
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
            {tasksByCategory.map(({ cat, count }) => {
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
      )}
      </div>
    </SectionErrorBoundary>
  )
}
