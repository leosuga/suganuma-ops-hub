"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useTitle } from "@/lib/useTitle"
import { useNotes, useUpdateNote } from "@/lib/queries/notes"
import { useTasks } from "@/lib/queries/tasks"
import { useTransactions } from "@/lib/queries/finance"
import { useHealthLogs, useAppointments } from "@/lib/queries/health"
import { parseContextTags, CONTEXT_CONFIG } from "@/lib/contexts"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { cn } from "@/lib/utils"

function getWeekRange() {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - 6)
  start.setHours(0, 0, 0, 0)
  const end = new Date(now)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function isWithinWeek(dateStr: string | null, weekStart: Date, weekEnd: Date) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  return d >= weekStart && d <= weekEnd
}

function formatWeekLabel(start: Date, end: Date) {
  const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short" }
  return `${start.toLocaleDateString("pt-BR", opts)} — ${end.toLocaleDateString("pt-BR", opts)}`
}

function contextBar(counts: Record<string, number>, total: number) {
  if (total === 0) return null
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden w-full mt-2">
      {Object.entries(counts).map(([ctx, count]) => {
        if (count === 0) return null
        const cfg = CONTEXT_CONFIG[ctx]
        if (!cfg) return null
        return (
          <div
            key={ctx}
            className={cn("h-full", cfg.bg.replace("/10", "").replace("bg-", "bg-"))}
            style={{ width: `${(count / total) * 100}%` }}
            title={`${cfg.label}: ${count}`}
          />
        )
      })}
    </div>
  )
}

export default function ReviewPage() {
  useTitle("Review · Suganuma Ops Hub")
  const { data: notes = [] } = useNotes()
  const { data: tasks = [] } = useTasks()
  const { data: transactions = [] } = useTransactions()
  const { data: healthLogs = [] } = useHealthLogs()
  const { data: appointments = [] } = useAppointments()
  const updateNote = useUpdateNote()
  const [markingDone, setMarkingDone] = useState(false)

  const { start: weekStart, end: weekEnd } = getWeekRange()
  const weekLabel = formatWeekRange(weekStart, weekEnd)

  // Notes created this week
  const weekNotes = notes.filter((n) => isWithinWeek(n.created_at, weekStart, weekEnd))
  const notesByContext = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const n of weekNotes) {
      for (const ctx of parseContextTags(n.tags)) {
        counts[ctx] = (counts[ctx] || 0) + 1
      }
    }
    return counts
  }, [weekNotes])

  // Tasks completed this week
  const weekTasksDone = tasks.filter((t) =>
    t.status === "done" && isWithinWeek(t.completed_at, weekStart, weekEnd)
  )
  const tasksByContext = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of weekTasksDone) {
      for (const tag of t.tags ?? []) {
        if (tag.startsWith("ctx/")) {
          const ctx = tag.slice(4)
          counts[ctx] = (counts[ctx] || 0) + 1
        }
      }
    }
    return counts
  }, [weekTasksDone])

  // Transactions this week
  const weekTransactions = transactions.filter((t) => {
    if (!t.occurred_on) return false
    const d = new Date(t.occurred_on + "T00:00:00")
    return d >= weekStart && d <= weekEnd
  })
  const weekIncome = weekTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + Number(t.amount), 0)
  const weekExpense = weekTransactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0)

  // Health logs this week
  const weekHealthLogs = healthLogs.filter((h) => isWithinWeek(h.logged_at, weekStart, weekEnd))
  const latestWeight = weekHealthLogs
    .filter((h) => h.kind === "weight")
    .sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime())[0]

  // Appointments this week
  const weekAppointments = appointments.filter((a) => {
    const d = new Date(a.starts_at)
    return d >= weekStart && d <= weekEnd
  })

  // Areas needing review (>30 days)
  const staleAreas = notes.filter((n) => {
    if (n.para !== "areas") return false
    if (!n.last_review) return true
    const days = (Date.now() - new Date(n.last_review).getTime()) / (1000 * 60 * 60 * 24)
    return days > 30
  })

  // Uncategorized notes
  const uncategorizedNotes = notes.filter((n) => parseContextTags(n.tags).length === 0)

  async function handleMarkReviewed() {
    setMarkingDone(true)
    const areaIds = staleAreas.map((n) => n.id)
    await Promise.all(
      areaIds.map((id) => updateNote.mutateAsync({ id, last_review: new Date().toISOString().slice(0, 10) }))
    )
    setMarkingDone(false)
  }

  const stats = [
    { label: "NOTAS", value: weekNotes.length, color: "text-teal" },
    { label: "TASKS DONE", value: weekTasksDone.length, color: "text-teal" },
    { label: "RECEITA", value: `R$ ${weekIncome.toFixed(2)}`, color: "text-teal" },
    { label: "DESPESA", value: `R$ ${weekExpense.toFixed(2)}`, color: "text-danger" },
    { label: "CONSULTAS", value: weekAppointments.length, color: "text-health" },
    { label: "PESO", value: latestWeight ? `${latestWeight.value} kg` : "—", color: "text-on-surface/40" },
  ]

  const hasAnyData = weekNotes.length > 0 || weekTasksDone.length > 0 || weekTransactions.length > 0 || weekAppointments.length > 0 || !!latestWeight

  return (
    <SectionErrorBoundary label="WEEKLY REVIEW">
      <div className="p-4 space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
              WEEKLY REVIEW
            </h1>
            <p className="text-[10px] font-mono text-on-surface/30 mt-0.5">{weekLabel}</p>
          </div>
          {staleAreas.length > 0 && (
            <button
              onClick={handleMarkReviewed}
              disabled={markingDone}
              className="h-7 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
            >
              {markingDone ? "..." : "MARCAR REVISADO"}
            </button>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {stats.map((s) => (
            <div key={s.label} className="border border-border bg-surface rounded-sm p-2 text-center">
              <div className={cn("text-[14px] font-mono font-semibold", s.color)}>{s.value}</div>
              <div className="text-[8px] font-mono text-on-surface/30 tracking-wider mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {!hasAnyData && (
          <div className="border border-border bg-surface rounded-sm p-8 text-center">
            <p className="text-[11px] font-mono text-on-surface/30">
              Sem dados esta semana. Use o app e volte aqui para ver seu resumo!
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <Link href="/tasks" className="text-[9px] font-mono text-teal hover:text-teal-hi transition-colors">
                + TASK
              </Link>
              <span className="text-on-surface/20">·</span>
              <Link href="/notes" className="text-[9px] font-mono text-teal hover:text-teal-hi transition-colors">
                + NOTA
              </Link>
              <span className="text-on-surface/20">·</span>
              <Link href="/finance" className="text-[9px] font-mono text-teal hover:text-teal-hi transition-colors">
                + TXN
              </Link>
            </div>
          </div>
        )}

        {/* Notes created this week */}
        {weekNotes.length > 0 && (
          <div className="border border-border bg-surface rounded-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">NOTAS CRIADAS</span>
              <span className="text-[9px] font-mono text-on-surface/20">{weekNotes.length}</span>
            </div>
            {contextBar(notesByContext, weekNotes.length)}
            <div className="divide-y divide-border">
              {weekNotes.slice(0, 10).map((n) => {
                const ctxs = parseContextTags(n.tags)
                const cfg = ctxs.length > 0 ? CONTEXT_CONFIG[ctxs[0]] : null
                return (
                  <Link
                    key={n.id}
                    href={`/notes?search=${encodeURIComponent(n.title)}`}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors"
                  >
                    {cfg && (
                      <span className={cn("w-1.5 h-1.5 rounded-full flex-none", cfg.bg.replace("/10", "").replace("bg-", "bg-"))} />
                    )}
                    <span className="text-[11px] font-mono text-on-surface truncate flex-1">{n.title}</span>
                    <span className="text-[9px] font-mono text-on-surface/20">
                      {new Date(n.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Tasks done by context */}
        {weekTasksDone.length > 0 && (
          <div className="border border-border bg-surface rounded-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">TASKS COMPLETADAS</span>
              <span className="text-[9px] font-mono text-on-surface/20">{weekTasksDone.length}</span>
            </div>
            {contextBar(tasksByContext, weekTasksDone.length)}
            <div className="divide-y divide-border">
              {weekTasksDone.slice(0, 10).map((t) => (
                <Link
                  key={t.id}
                  href="/tasks"
                  className="flex items-center gap-2 px-3 py-2 hover:bg-surface-hover transition-colors"
                >
                  <span className="text-[10px] font-mono text-teal flex-none">✓</span>
                  <span className="text-[11px] font-mono text-on-surface truncate flex-1 line-through opacity-40">{t.title}</span>
                  <span className="text-[9px] font-mono text-on-surface/20">
                    {t.completed_at ? new Date(t.completed_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) : ""}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Transactions */}
        {weekTransactions.length > 0 && (
          <div className="border border-border bg-surface rounded-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">TRANSAÇÕES</span>
              <span className="text-[9px] font-mono text-on-surface/20">{weekTransactions.length}</span>
            </div>
            <div className="divide-y divide-border">
              {weekTransactions.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center gap-2 px-3 py-2">
                  <span className={cn("text-[11px] font-mono tabular-nums flex-none", t.amount > 0 ? "text-teal" : "text-danger")}>
                    {t.amount > 0 ? "+" : ""}
                    {Number(t.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-[11px] font-mono text-on-surface truncate flex-1">{t.description || t.category}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alerts */}
        {(staleAreas.length > 0 || uncategorizedNotes.length > 0) && (
          <div className="space-y-2">
            {staleAreas.length > 0 && (
              <div className="border border-amber/30 bg-amber/5 rounded-sm p-3">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-amber">⚠</span>
                  <span className="text-[11px] font-mono text-amber/80">
                    {staleAreas.length} {staleAreas.length === 1 ? "área" : "áreas"} sem revisão {'>'}30 dias
                  </span>
                </div>
                <div className="mt-1.5 space-y-1">
                  {staleAreas.slice(0, 5).map((n) => (
                    <Link
                      key={n.id}
                      href={`/notes?search=${encodeURIComponent(n.title)}`}
                      className="block text-[10px] font-mono text-on-surface/50 hover:text-teal truncate"
                    >
                      → {n.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {uncategorizedNotes.length > 0 && (
              <Link
                href="/notes"
                className="flex items-center gap-2 px-3 py-2 border border-amber/30 bg-amber/5 rounded-sm hover:bg-amber/10 transition-colors"
              >
                <span className="text-[10px] font-mono text-amber">⚠</span>
                <span className="text-[11px] font-mono text-amber/80">
                  {uncategorizedNotes.length} {uncategorizedNotes.length === 1 ? 'nota sem' : 'notas sem'} contexto
                </span>
              </Link>
            )}
          </div>
        )}
      </div>
    </SectionErrorBoundary>
  )
}
