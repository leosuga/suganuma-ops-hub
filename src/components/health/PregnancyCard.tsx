"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { usePregnancy, useUpsertPregnancy } from "@/lib/queries/health"

const HEALTH_COLOR = "text-[#A8D8B0]"
const HEALTH_BORDER = "border-[#A8D8B0]/40"
const HEALTH_BG = "bg-[#A8D8B0]/10"

function weeksFromDueDate(dueDate: string): number {
  const due = new Date(dueDate)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const weeksLeft = diffMs / (7 * 24 * 60 * 60 * 1000)
  return Math.max(0, Math.round(40 - weeksLeft))
}

export function PregnancyCard() {
  const { data: pregnancy, isLoading } = usePregnancy()
  const upsert = useUpsertPregnancy()
  const [editing, setEditing] = useState(false)
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")

  function startEdit() {
    setDueDate(pregnancy?.due_date ?? "")
    setNotes(pregnancy?.notes ?? "")
    setEditing(true)
  }

  async function handleSave() {
    const week = dueDate ? weeksFromDueDate(dueDate) : null
    await upsert.mutateAsync({
      id: pregnancy?.id,
      due_date: dueDate || null,
      week,
      notes: notes || null,
    })
    setEditing(false)
  }

  const currentWeek = pregnancy?.due_date
    ? weeksFromDueDate(pregnancy.due_date)
    : pregnancy?.week ?? null

  const inputClass = "w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-[#A8D8B0] transition-colors"

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className={cn("text-[9px] font-mono font-semibold tracking-widest uppercase", HEALTH_COLOR)}>
          GRAVIDEZ
        </span>
        <button
          onClick={editing ? () => setEditing(false) : startEdit}
          className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors"
        >
          {editing ? "CANCELAR" : "EDITAR"}
        </button>
      </div>

      {isLoading ? (
        <div className="p-4 h-24 animate-pulse" />
      ) : editing ? (
        <div className="p-4 flex flex-col gap-3">
          <div>
            <label className="text-[9px] font-mono text-on-surface/40 uppercase tracking-widest block mb-1">
              Data prevista do parto
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="text-[9px] font-mono text-on-surface/40 uppercase tracking-widest block mb-1">
              Notas
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Observações..."
              className={inputClass}
            />
          </div>
          <button
            onClick={handleSave}
            disabled={upsert.isPending}
            className={cn("h-8 px-4 border rounded-sm text-[10px] font-mono font-semibold tracking-wider transition-colors self-end", HEALTH_BORDER, HEALTH_COLOR, HEALTH_BG, "hover:bg-[#A8D8B0]/20 disabled:opacity-30")}
          >
            {upsert.isPending ? "SALVANDO..." : "SALVAR →"}
          </button>
        </div>
      ) : pregnancy ? (
        <div className="p-4 flex items-center gap-6">
          {currentWeek !== null && (
            <div className="flex flex-col items-center">
              <span className={cn("text-[40px] font-mono font-bold leading-none", HEALTH_COLOR)}>
                {currentWeek}
              </span>
              <span className="text-[9px] font-mono text-on-surface/40 uppercase tracking-widest mt-1">
                semanas
              </span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            {pregnancy.due_date && (
              <p className="text-[11px] font-mono text-on-surface/60">
                DPP:{" "}
                <span className="text-on-surface">
                  {new Date(pregnancy.due_date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
                </span>
              </p>
            )}
            {pregnancy.notes && (
              <p className="text-[11px] font-mono text-on-surface/40 mt-1 truncate">{pregnancy.notes}</p>
            )}
            {currentWeek !== null && (
              <div className="mt-2 h-1.5 bg-bg rounded-full overflow-hidden w-full">
                <div
                  className="h-full bg-[#A8D8B0] rounded-full transition-all"
                  style={{ width: `${Math.min(100, (currentWeek / 40) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 flex items-center justify-center h-20">
          <button
            onClick={startEdit}
            className={cn("text-[11px] font-mono transition-colors", HEALTH_COLOR, "hover:opacity-70")}
          >
            + Configurar acompanhamento de gravidez
          </button>
        </div>
      )}
    </div>
  )
}
