"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useTasks, useToggleTaskDone } from "@/lib/queries/tasks"
import type { ChildRow } from "@/lib/queries/baby"
import { saoPauloDate } from "@/lib/baby/dates"
import { cn } from "@/lib/utils"

const CareScheduleDialog = dynamic(
  () => import("./CareScheduleDialog").then((m) => ({ default: m.CareScheduleDialog })),
  { ssr: false },
)

function fmt(dateStr: string): string {
  const [, m, d] = dateStr.split("-")
  return `${d}/${m}`
}

interface CareTimelineProps {
  child: ChildRow
  todayStr: string
}

export function CareTimeline({ child, todayStr }: CareTimelineProps) {
  const { data: tasks = [], isLoading } = useTasks()
  const toggleDone = useToggleTaskDone()
  const [dialogOpen, setDialogOpen] = useState(false)

  const projectId = child.project_id
  const upcoming = useMemo(() => {
    if (!projectId) return []
    return tasks
      .filter((t) => t.project_id === projectId && (t.status === "todo" || t.status === "doing") && t.due_at)
      .sort((a, b) => (a.due_at ?? "").localeCompare(b.due_at ?? ""))
  }, [tasks, projectId])

  const overdue = upcoming.filter((t) => saoPauloDate(t.due_at!) < todayStr)
  const next = upcoming.filter((t) => saoPauloDate(t.due_at!) >= todayStr).slice(0, 5)
  const rows = [...overdue, ...next]

  return (
    <section className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center justify-between border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
          CUIDADOS · {overdue.length > 0 ? `${overdue.length} ATRASADO(S)` : "PRÓXIMOS"}
        </span>
        {projectId && (
          <Link href="/tasks" className="text-[9px] font-mono text-on-surface/40 hover:text-on-surface/70">
            VER TUDO →
          </Link>
        )}
      </div>

      {!projectId ? (
        <div className="p-4 space-y-2">
          <p className="text-[11px] font-mono text-on-surface/60 leading-snug">
            Gere o cronograma de triagens, consultas, vacinas, documentos, cuidados da mãe e compras
            a partir do nascimento. Você revisa a lista antes de criar.
          </p>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="h-9 px-4 border border-health text-health font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-health/20"
          >
            GERAR CRONOGRAMA →
          </button>
        </div>
      ) : isLoading ? (
        <div className="p-4 h-16 animate-pulse" />
      ) : rows.length === 0 ? (
        <p className="p-4 text-[11px] font-mono text-on-surface/40">Nada pendente no cronograma.</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((t) => {
            const late = saoPauloDate(t.due_at!) < todayStr
            return (
              <div key={t.id} className="flex items-center gap-3 min-h-[44px] px-4">
                <input
                  type="checkbox"
                  checked={false}
                  onChange={() => toggleDone(t)}
                  aria-label={`Concluir: ${t.title}`}
                  className="h-4 w-4 flex-none"
                />
                <span className={cn("text-[10px] font-mono w-11 flex-none", late ? "text-danger" : "text-on-surface/40")}>
                  {fmt(saoPauloDate(t.due_at!))}
                </span>
                <span className="flex-1 text-[12px] font-mono text-on-surface leading-snug">{t.title}</span>
              </div>
            )
          })}
        </div>
      )}

      {dialogOpen && <CareScheduleDialog child={child} open={dialogOpen} onOpenChange={setDialogOpen} />}
    </section>
  )
}
