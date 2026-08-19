"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useTitle } from "@/lib/useTitle"
import { useTasks } from "@/lib/queries/tasks"
import { useInbox } from "@/lib/queries/inbox"
import { useAppointments } from "@/lib/queries/health"
import { useUpcomingEvents } from "@/lib/queries/annual"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { today } from "@/lib/date"
import { cn } from "@/lib/utils"

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

function CockpitPageInner() {
  useTitle("Cockpit · Suganuma Ops Hub")
  const { data: tasks = [], isLoading: tasksLoading } = useTasks()
  const { data: inboxItems = [], isLoading: inboxLoading } = useInbox("unprocessed")
  const { data: appointments = [], isLoading: apptsLoading } = useAppointments()
  const { data: events = [], isLoading: eventsLoading } = useUpcomingEvents(5)
  const loading = tasksLoading || inboxLoading || apptsLoading || eventsLoading

  const now = new Date()
  const todayStr = today()

  const pending = useMemo(() => tasks.filter((t) => t.status === "todo" || t.status === "doing"), [tasks])

  const urgent = useMemo(
    () =>
      pending.filter(
        (t) => t.priority === "urgent" || (t.important && t.due_at && new Date(t.due_at) < now)
      ).slice(0, 5),
    [pending]
  )

  const overdue = useMemo(
    () => pending.filter((t) => t.due_at && new Date(t.due_at) < now && t.status !== "done").slice(0, 5),
    [pending]
  )

  const quickWins = useMemo(
    () => pending.filter((t) => t.priority === "low" || t.priority === "med").slice(0, 5),
    [pending]
  )

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
          <p className="text-[10px] font-mono text-on-surface/30 mt-0.5 capitalize">{dateLabel}</p>
        </div>

        {loading && (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-surface border border-border rounded-sm animate-pulse" />
            ))}
          </div>
        )}

        {!loading && (
        <>
        {/* Inbox */}
        <div className="border border-border bg-surface rounded-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              INBOX
            </span>
            <Link href="/inbox" className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors">
              ABRIR →
            </Link>
          </div>
          {inboxItems.length === 0 ? (
            <div className="px-4 py-4 text-[10px] font-mono text-on-surface/20">
              Inbox zero. Nada pendente de triagem.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {inboxItems.slice(0, 3).map((item) => (
                <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="flex-1 text-[11px] font-mono text-on-surface truncate">{item.content}</span>
                  <span className="flex-none text-[8px] font-mono text-amber">{inboxItems.length} pendente{inboxItems.length !== 1 ? "s" : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Urgent + Overdue */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="border border-border bg-surface rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-danger uppercase">
                URGENTES
              </span>
            </div>
            {urgent.length === 0 ? (
              <div className="px-4 py-4 text-[10px] font-mono text-on-surface/20">Nenhuma urgente</div>
            ) : (
              <div className="divide-y divide-border">
                {urgent.map((t) => (
                  <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="flex-1 text-[11px] font-mono text-on-surface truncate">{t.title}</span>
                    {t.due_at && (
                      <span className="flex-none text-[9px] font-mono text-danger">{fmtDate(t.due_at)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-border bg-surface rounded-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-amber uppercase">
                ATRASADAS ({overdue.length})
              </span>
            </div>
            {overdue.length === 0 ? (
              <div className="px-4 py-4 text-[10px] font-mono text-on-surface/20">Nenhuma atrasada</div>
            ) : (
              <div className="divide-y divide-border">
                {overdue.map((t) => (
                  <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                    <span className="flex-1 text-[11px] font-mono text-on-surface truncate">{t.title}</span>
                    <span className="flex-none text-[9px] font-mono text-amber">{fmtDate(t.due_at!)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick wins */}
        <div className="border border-border bg-surface rounded-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-teal uppercase">
              QUICK WINS
            </span>
          </div>
          {quickWins.length === 0 ? (
            <div className="px-4 py-4 text-[10px] font-mono text-on-surface/20">Nenhum quick win</div>
          ) : (
            <div className="divide-y divide-border">
              {quickWins.map((t) => (
                <div key={t.id} className="px-4 py-2.5 flex items-center gap-3">
                  <span className="flex-1 text-[11px] font-mono text-on-surface truncate">{t.title}</span>
                  <span className="flex-none text-[8px] font-mono text-on-surface/30">{t.priority.toUpperCase()}</span>
                </div>
              ))}
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
              <div className="px-4 py-4 text-[10px] font-mono text-on-surface/20">Nenhuma consulta</div>
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
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
                EVENTOS
              </span>
            </div>
            {todayEvents.length === 0 ? (
              <div className="px-4 py-4 text-[10px] font-mono text-on-surface/20">Nenhum evento hoje</div>
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
          <span className="text-[8px] font-mono text-on-surface/30">
            {pending.length} pendentes
          </span>
          <span className="text-[8px] font-mono text-on-surface/30">
            {urgent.length} urgentes
          </span>
          <span className="text-[8px] font-mono text-on-surface/30">
            {overdue.length} atrasadas
          </span>
          <span className="text-[8px] font-mono text-on-surface/30">
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