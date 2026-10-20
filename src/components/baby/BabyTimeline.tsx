"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useCreateBabyLog, useDeleteBabyLog, type BabyLogRow } from "@/lib/queries/baby"
import { formatClock, formatLogLine } from "@/lib/baby/quick-log"
import { saoPauloDate } from "@/lib/baby/dates"
import { useUndoToast } from "@/components/UndoToast"
import type { BabyLog } from "@/lib/schemas/baby"

const EditBabyLogDialog = dynamic(
  () => import("./EditBabyLogDialog").then((m) => ({ default: m.EditBabyLogDialog })),
  { ssr: false },
)

interface BabyTimelineProps {
  logs: BabyLogRow[]
  /** Data de hoje (YYYY-MM-DD, São Paulo). */
  todayStr: string
}

export function BabyTimeline({ logs, todayStr }: BabyTimelineProps) {
  const deleteLog = useDeleteBabyLog()
  const createLog = useCreateBabyLog()
  const toast = useUndoToast()
  const [editing, setEditing] = useState<BabyLogRow | null>(null)

  const today = useMemo(
    () => logs.filter((l) => saoPauloDate(l.started_at) === todayStr),
    [logs, todayStr],
  )

  function handleDelete(log: BabyLogRow) {
    deleteLog.mutate(log.id, {
      onSuccess: () =>
        toast.show({
          label: `${formatLogLine(log)} excluído`,
          onUndo: () =>
            createLog.mutate({
              child_id: log.child_id,
              kind: log.kind,
              started_at: log.started_at,
              ended_at: log.ended_at,
              data: log.data,
              notes: log.notes,
            } as BabyLog),
        }),
    })
  }

  return (
    <section className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase">
          HOJE · {today.length} REGISTROS
        </span>
      </div>
      {today.length === 0 ? (
        <p className="p-4 text-[11px] font-mono text-on-surface/60">Nenhum registro hoje.</p>
      ) : (
        <div className="divide-y divide-border">
          {today.map((l) => (
            <div key={l.id} className="flex items-center gap-3 min-h-[40px] px-4">
              <span className="text-[11px] font-mono text-on-surface/60 w-11 flex-none">{formatClock(l.started_at)}</span>
              <span className="flex-1 text-[12px] font-mono text-on-surface truncate">{formatLogLine(l)}</span>
              <button
                type="button"
                onClick={() => setEditing(l)}
                aria-label="Editar registro"
                className="min-h-[40px] min-w-[32px] text-[12px] text-on-surface/60 hover:text-on-surface/70"
              >
                ✎
              </button>
              <button
                type="button"
                onClick={() => handleDelete(l)}
                aria-label="Excluir registro"
                className="min-h-[40px] min-w-[32px] text-[14px] text-on-surface/60 hover:text-danger"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
      <EditBabyLogDialog log={editing} onOpenChange={(v) => { if (!v) setEditing(null) }} />
    </section>
  )
}
