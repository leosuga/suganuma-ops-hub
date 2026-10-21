"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useTitle } from "@/lib/useTitle"
import { useTasks, useToggleTaskDone, type TaskRow } from "@/lib/queries/tasks"
import { useInbox, useConvertInboxToTask, useConvertInboxToNote, useArchiveInboxItem } from "@/lib/queries/inbox"
import type { InboxItemRow } from "@/lib/types"
import { useAppointments } from "@/lib/queries/health"
import { useUpcomingEvents } from "@/lib/queries/annual"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { BabyCockpitWidget } from "@/components/baby/BabyCockpitWidget"
import { today, dateStr } from "@/lib/date"
import { cn } from "@/lib/utils"

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function TaskCheckbox({ task, onToggle }: { task: TaskRow; onToggle: (task: TaskRow) => void }) {
  const isDone = task.status === "done"
  return (
    <button
      onClick={() => onToggle(task)}
      aria-label={isDone ? "Marcar como pendente" : "Marcar como concluída"}
      className={cn(
        "flex-none w-3.5 h-3.5 rounded-[3px] border transition-colors",
        isDone ? "bg-teal border-teal flex items-center justify-center" : "border-on-surface/30 hover:border-teal"
      )}
    >
      {isDone && (
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-bg">
          <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

function CockpitPageInner() {
  useTitle("Cockpit · Suganuma Ops Hub")
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: inboxItems = [], isLoading: inboxLoading } = useInbox("unprocessed")
  const { data: appointments = [], isLoading: apptsLoading } = useAppointments()
  const { data: events = [], isLoading: eventsLoading } = useUpcomingEvents(5)
  const loading = tasksLoading || inboxLoading || apptsLoading || eventsLoading

  const toggleDone = useToggleTaskDone()
  const convertToTask = useConvertInboxToTask()
  const convertToNote = useConvertInboxToNote()
  const archiveInboxItem = useArchiveInboxItem()
  const [converting, setConverting] = useState<string | null>(null)

  async function handleConvertToTask(item: InboxItemRow) {
    setConverting(item.id)
    try {
      await convertToTask(item)
    } finally {
      setConverting(null)
    }
  }

  async function handleConvertToNote(item: InboxItemRow) {
    setConverting(item.id)
    try {
      await convertToNote(item)
    } finally {
      setConverting(null)
    }
  }

  const now = new Date()
  const todayStr = today()

  const pending = useMemo(() => tasks.filter((t) => t.status === "todo" || t.status === "doing"), [tasks])

  const urgent = useMemo(
    () =>
      pending.filter(
        (t) => t.priority === "urgent" || (t.important && t.due_at && new Date(t.due_at) < now)
      ),
    [pending]
  )

  const overdue = useMemo(
    () => pending.filter((t) => t.due_at && new Date(t.due_at) < now && t.status !== "done"),
    [pending]
  )

  // FOCO — a fila do dia: o que fazer agora, ranqueada e COM MOTIVO.
  // Ordem: atrasado > vence hoje > urgente > importante > quick win.
  // Substituiu três cards soltos (Urgentes / Atrasadas / Quick Wins) que
  // mostravam a mesma task em 2-3 lugares, sem ranking e sem explicação.
  const focus = useMemo(() => {
    const nowMs = Date.now()
    const items: Array<{
      task: TaskRow
      reason: string
      tone: "danger" | "amber" | "teal"
      tier: number
    }> = []
    for (const t of pending) {
      const due = t.due_at ? new Date(t.due_at).getTime() : null
      if (due !== null && due < nowMs) {
        const days = Math.max(1, Math.round((nowMs - due) / 86400000))
        items.push({ task: t, reason: `atrasado ${days}d`, tone: "danger", tier: 0 })
      } else if (due !== null && dateStr(new Date(due)) === todayStr) {
        items.push({ task: t, reason: "vence hoje", tone: "amber", tier: 1 })
      } else if (t.priority === "urgent") {
        items.push({ task: t, reason: "urgente", tone: "danger", tier: 2 })
      } else if (t.important) {
        items.push({ task: t, reason: "importante", tone: "teal", tier: 3 })
      } else if (t.energy_level === "low" || (t.priority === "low" && !t.energy_level)) {
        items.push({ task: t, reason: "quick win", tone: "teal", tier: 4 })
      }
    }
    return items.sort((a, b) => a.tier - b.tier)
  }, [pending, todayStr])

  const upcomingAppts = useMemo(
    () => appointments.filter((a) => new Date(a.starts_at) >= now).slice(0, 5),
    [appointments]
  )

  const todayEvents = useMemo(
    () => events.filter((e) => e.start_date <= todayStr && e.end_date >= todayStr),
    [events, todayStr]
  )

  const dateLabel = now.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })

  return (
    <SectionErrorBoundary label="COCKPIT">
      <div className="p-4 space-y-5 max-w-3xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
            COCKPIT
          </h1>
          <p className="text-[10px] font-mono text-on-surface/60 mt-0.5 capitalize">{dateLabel}</p>
        </div>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-surface border border-border rounded-sm animate-pulse" />
            ))}
          </div>
        )}

        <BabyCockpitWidget />

        {/* FOCO — o que fazer agora, ranqueado e com motivo */}
        <div className="border border-border bg-surface rounded-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-teal uppercase">
              FOCO
            </span>
            <Link href="/tasks" className="text-[9px] font-mono text-on-surface/60 hover:text-on-surface/60 transition-colors">
              TODAS →
            </Link>
          </div>
          {focus.length === 0 ? (
            <div className="px-4 py-4 text-[10px] font-mono text-on-surface/60">
              Nada no foco. Dia limpo.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {focus.slice(0, 6).map(({ task, reason, tone }) => (
                <div key={task.id} className="px-4 py-2.5 flex items-center gap-3">
                  <TaskCheckbox task={task} onToggle={toggleDone} />
                  <Link
                    href={`/tasks?search=${encodeURIComponent(task.title)}`}
                    className="flex-1 text-[11px] font-mono text-on-surface truncate hover:text-teal transition-colors"
                  >
                    {task.title}
                  </Link>
                  <span
                    className={cn(
                      "flex-none text-[9px] font-mono font-semibold tracking-wider uppercase",
                      tone === "danger" ? "text-danger" : tone === "amber" ? "text-amber" : "text-teal"
                    )}
                  >
                    {reason}
                  </span>
                </div>
              ))}
            </div>
          )}
          {focus.length > 6 && (
            <div className="px-4 py-2 text-[9px] font-mono text-on-surface/60">
              +{focus.length - 6} outras no{" "}
              <Link href="/tasks" className="hover:text-on-surface/60 transition-colors">
                /tasks
              </Link>
            </div>
          )}
        </div>

        {!loading && (
        <>
        {/* Inbox */}
        <div className="border border-border bg-surface rounded-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase">
              INBOX
            </span>
            <Link href="/inbox" className="text-[9px] font-mono text-on-surface/60 hover:text-on-surface/60 transition-colors">
              ABRIR →
            </Link>
          </div>
          {inboxItems.length === 0 ? (
            <div className="px-4 py-4 text-[10px] font-mono text-on-surface/60">
              Inbox zero. Nada pendente de triagem.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {inboxItems.slice(0, 3).map((item) => (
                <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="flex-1 text-[11px] font-mono text-on-surface truncate">{item.content}</span>
                  <div className="flex-none flex items-center gap-1.5">
                    <button
                      onClick={() => handleConvertToTask(item)}
                      disabled={converting === item.id}
                      className="h-8 px-2.5 bg-teal/10 border border-teal/40 text-teal font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
                    >
                      {converting === item.id ? "..." : "TASK"}
                    </button>
                    <button
                      onClick={() => handleConvertToNote(item)}
                      disabled={converting === item.id}
                      className="h-8 px-2.5 bg-amber/10 border border-amber/40 text-amber font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-amber/20 disabled:opacity-30 transition-colors"
                    >
                      {converting === item.id ? "..." : "NOTE"}
                    </button>
                    <button
                      onClick={() => archiveInboxItem.mutate(item.id)}
                      className="h-8 px-2.5 bg-on-surface/5 border border-border text-on-surface/60 font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-on-surface/10 transition-colors"
                    >
                      ARQ
                    </button>
                  </div>
                </div>
              ))}
              {inboxItems.length > 3 && (
                <div className="px-4 py-2 text-[9px] font-mono text-on-surface/60">
                  +{inboxItems.length - 3} mais em{" "}
                  <Link href="/inbox" className="text-on-surface/60 hover:text-on-surface/60 transition-colors">
                    /inbox
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Appointments + Events */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-border bg-surface rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-health uppercase">
                CONSULTAS
              </span>
            </div>
            {upcomingAppts.length === 0 ? (
              <div className="px-4 py-4 text-[10px] font-mono text-on-surface/60">Nenhuma consulta</div>
            ) : (
              <div className="divide-y divide-border">
                {upcomingAppts.map((a) => (
                  <div key={a.id} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="flex-1 text-[11px] font-mono text-on-surface truncate">{a.title}</span>
                    <span className="flex-none text-[9px] font-mono text-health">{fmtTime(a.starts_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-border bg-surface rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase">
                EVENTOS
              </span>
            </div>
            {todayEvents.length === 0 ? (
              <div className="px-4 py-4 text-[10px] font-mono text-on-surface/60">Nenhum evento hoje</div>
            ) : (
              <div className="divide-y divide-border">
                {todayEvents.map((e) => (
                  <div key={e.id} className="px-4 py-2.5 flex items-center gap-3">
                    <span
                      className="w-2 h-2 rounded-full flex-none"
                      style={{ backgroundColor: e.color }}
                    />
                    <span className="flex-1 text-[11px] font-mono text-on-surface truncate">{e.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Summary strip */}
        <div className="flex items-center gap-4 px-4 py-2 border border-border bg-surface rounded-sm">
          <span className="text-[8px] font-mono text-on-surface/60">
            {pending.length} pendentes
          </span>
          <span className="text-[8px] font-mono text-on-surface/60">
            {urgent.length} urgentes
          </span>
          <span className="text-[8px] font-mono text-on-surface/60">
            {overdue.length} atrasadas
          </span>
          <span className="text-[8px] font-mono text-on-surface/60">
            {inboxItems.length} no inbox
          </span>
        </div>
        </>
        )}
      </div>
    </SectionErrorBoundary>
  )
}

export default function CockpitPage() {
  return <CockpitPageInner />
}