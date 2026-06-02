"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { TaskRow } from "@/lib/queries/tasks"
import type { AnnualEventRow } from "@/lib/types"
import type { AppointmentRow } from "@/lib/types/health"

interface NeedsAttentionProps {
  tasks: TaskRow[]
  urgentCount: number
  events?: AnnualEventRow[]
  appointments?: AppointmentRow[]
}

type AttentionItem =
  | {
      id: string
      type: "task"
      title: string
      due_at: string | null
      priority: string
      status: string
    }
  | {
      id: string
      type: "event"
      title: string
      start_date: string
      end_date: string
      color: string
      start_time: string | null
    }
  | {
      id: string
      type: "appointment"
      title: string
      starts_at: string
      kind: string | null
      location: string | null
    }

function buildItems(
  tasks: TaskRow[],
  events: AnnualEventRow[],
  appointments: AppointmentRow[]
): AttentionItem[] {
  const taskItems: AttentionItem[] = tasks.map((t) => ({
    type: "task",
    id: t.id,
    title: t.title,
    due_at: t.due_at,
    priority: t.priority,
    status: t.status,
  }))

  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const eventItems: AttentionItem[] = events
    .filter((e) => e.start_date <= tomorrowStr && e.end_date >= tomorrowStr)
    .map((e) => ({
      type: "event",
      id: e.id,
      title: e.title,
      start_date: e.start_date,
      end_date: e.end_date,
      color: e.color,
      start_time: e.start_time,
    }))

  const appointmentItems: AttentionItem[] = appointments
    .filter((a) => {
      const d = new Date(a.starts_at)
      return d >= now && d < tomorrow
    })
    .map((a) => ({
      type: "appointment",
      id: a.id,
      title: a.title,
      starts_at: a.starts_at,
      kind: a.kind,
      location: a.location,
    }))

  return [...taskItems, ...eventItems, ...appointmentItems].sort((a, b) => {
    const getTs = (item: AttentionItem) => {
      if (item.type === "task") {
        if (!item.due_at) return Infinity
        return new Date(item.due_at).getTime()
      }
      if (item.type === "event") {
        return new Date(item.start_date + "T00:00:00").getTime()
      }
      return new Date(item.starts_at).getTime()
    }
    return getTs(a) - getTs(b)
  })
}

function getLabel(item: AttentionItem) {
  if (item.type === "task") {
    if (item.status === "done") return null
    if (!item.due_at) return null
    const due = new Date(item.due_at)
    const now = new Date()
    const diffMs = due.getTime() - now.getTime()
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
    if (diffDays < 0) return "ATRASADA"
    if (diffDays === 0) return "HOJE"
    return null
  }
  if (item.type === "event") {
    const todayStr = new Date().toISOString().slice(0, 10)
    if (item.start_date === todayStr || item.end_date === todayStr) return "HOJE"
    return "AMANHÃ"
  }
  if (item.type === "appointment") {
    const d = new Date(item.starts_at)
    const now = new Date()
    const todayStr = now.toISOString().slice(0, 10)
    const aptDateStr = item.starts_at.slice(0, 10)
    if (aptDateStr === todayStr) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    }
    return "AMANHÃ"
  }
  return null
}

export function NeedsAttention({ tasks, urgentCount, events = [], appointments = [] }: NeedsAttentionProps) {
  const items = buildItems(tasks, events, appointments)
  if (items.length === 0) return null

  const hasUrgent = urgentCount > 0
  const hasEvents = events.length > 0
  const hasAppointments = appointments.length > 0

  let label = "PRÓXIMAS TASKS"
  if (hasUrgent) label = "PRECISA DE ATENÇÃO"
  if (hasAppointments) label = "ATENÇÃO NECESSÁRIA"

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
          {label}
        </span>
        <div className="flex items-center gap-3">
          {hasEvents && (
            <Link
              href="/calendar/year"
              className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors"
            >
              CALENDÁRIO →
            </Link>
          )}
          <Link href="/tasks" className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors">
            VER TASKS →
          </Link>
        </div>
      </div>
      <div className="divide-y divide-border">
        {items.map((item) => {
          const label = getLabel(item)

          if (item.type === "task") {
            const isOverdue = item.due_at && item.status !== "done" && new Date(item.due_at) < new Date()
            const dueText = item.due_at
              ? new Date(item.due_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
              : null

            return (
              <div key={item.id} className="flex items-center gap-3 h-10 px-4">
                <span className={cn(
                  "flex-1 text-[12px] font-mono truncate",
                  item.priority === "urgent" ? "text-danger" : "text-on-surface"
                )}>
                  {item.title}
                </span>
                {dueText && (
                  <span className={cn(
                    "flex-none text-[10px] font-mono",
                    isOverdue ? "text-danger" : "text-on-surface/30"
                  )}>
                    {dueText}
                  </span>
                )}
                {label && (
                  <span className={cn(
                    "flex-none text-[9px] font-mono font-semibold tracking-wider uppercase",
                    isOverdue ? "text-danger" : "text-amber"
                  )}>
                    {label}
                  </span>
                )}
              </div>
            )
          }

          if (item.type === "event") {
            const dateText = new Date(item.start_date + "T00:00:00").toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
            })
            const timeText = item.start_time ? ` ${item.start_time.slice(0, 5)}` : ""

            return (
              <Link
                key={item.id}
                href="/calendar/year"
                className="flex items-center gap-3 h-10 px-4 hover:bg-bg/50 transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full flex-none"
                  style={{ backgroundColor: item.color }}
                />
                <span className="flex-1 text-[12px] font-mono text-on-surface truncate">
                  {item.title}
                </span>
                <span className="flex-none text-[10px] font-mono text-on-surface/30">
                  {dateText}
                  <span className="text-teal">{timeText}</span>
                </span>
                {label && (
                  <span className={cn(
                    "flex-none text-[9px] font-mono font-semibold tracking-wider uppercase",
                    label === "HOJE" ? "text-teal" : "text-amber"
                  )}>
                    {label}
                  </span>
                )}
              </Link>
            )
          }

          if (item.type === "appointment") {
            const timeText = new Date(item.starts_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })

            return (
              <Link
                key={item.id}
                href="/health"
                className="flex items-center gap-3 h-10 px-4 hover:bg-bg/50 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-health flex-none" />
                <span className="flex-1 text-[12px] font-mono text-on-surface truncate">
                  {item.title}
                </span>
                {item.location && (
                  <span className="flex-none text-[10px] font-mono text-on-surface/30 truncate max-w-[80px]">
                    {item.location}
                  </span>
                )}
                <span className="flex-none text-[10px] font-mono text-on-surface/30">
                  {timeText}
                </span>
                {label && (
                  <span className={cn(
                    "flex-none text-[9px] font-mono font-semibold tracking-wider uppercase",
                    label.includes(":") ? "text-health" : "text-amber"
                  )}>
                    {label}
                  </span>
                )}
              </Link>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}
