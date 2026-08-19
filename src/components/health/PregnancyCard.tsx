"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { usePregnancy, useUpsertPregnancy, useAppointments } from "@/lib/queries/health"
import { today } from "@/lib/date"

const HEALTH_COLOR = "text-health"
const HEALTH_BORDER = "border-health/40"
const HEALTH_BG = "bg-health/10"

// Marcos obstétricos padrão (convenção clínica brasileira), semana → o que marca.
const MILESTONES: { week: number; label: string }[] = [
  { week: 12, label: "Fim do 1º trimestre" },
  { week: 20, label: "Exame morfológico" },
  { week: 24, label: "Viabilidade fetal" },
  { week: 28, label: "Início do 3º trimestre" },
  { week: 37, label: "A termo" },
  { week: 40, label: "DPP" },
]

function trimesterOf(week: number): 1 | 2 | 3 {
  if (week < 14) return 1
  if (week < 28) return 2
  return 3
}

function weeksFromDueDate(dueDate: string): number {
  const due = new Date(dueDate)
  const now = new Date()
  const diffMs = due.getTime() - now.getTime()
  const weeksLeft = diffMs / (7 * 24 * 60 * 60 * 1000)
  return Math.max(0, Math.round(40 - weeksLeft))
}

// Diferença em dias entre hoje (fuso São Paulo) e a data prevista — âncora em
// UTC meia-noite para não depender do fuso do navegador/servidor.
function daysUntil(dueDate: string): number {
  const due = new Date(`${dueDate}T00:00:00Z`)
  const now = new Date(`${today()}T00:00:00Z`)
  return Math.round((due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
}

export function PregnancyCard() {
  const { data: pregnancy, isLoading } = usePregnancy()
  const { data: appointments = [] } = useAppointments()
  const upsert = useUpsertPregnancy()
  const [editing, setEditing] = useState(false)
  const [dueDate, setDueDate] = useState("")
  const [notes, setNotes] = useState("")

  const prenatalAppointments = useMemo(
    () =>
      appointments
        .filter((a) => a.kind?.toLowerCase() === "prenatal")
        .sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()),
    [appointments]
  )

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

  const daysLeft = pregnancy?.due_date ? daysUntil(pregnancy.due_date) : null
  const trimester = currentWeek !== null ? trimesterOf(currentWeek) : null
  const nextMilestone =
    currentWeek !== null ? MILESTONES.find((m) => m.week > currentWeek) ?? null : null

  const inputClass = "w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:border-health transition-colors"

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className={cn("text-[9px] font-mono font-semibold tracking-widest uppercase", HEALTH_COLOR)}>
          GRAVIDEZ
        </span>
        <button
          onClick={editing ? () => setEditing(false) : startEdit}
          className="text-[9px] font-mono text-on-surface/40 hover:text-on-surface/60 transition-colors"
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
            className={cn("h-8 px-4 border rounded-sm text-[10px] font-mono font-semibold tracking-wider transition-colors self-end", HEALTH_BORDER, HEALTH_COLOR, HEALTH_BG, "hover:bg-health/20 disabled:opacity-30")}
          >
            {upsert.isPending ? "SALVANDO..." : "SALVAR →"}
          </button>
        </div>
      ) : pregnancy ? (
        <>
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
              {daysLeft !== null && (
                <p className="text-[11px] font-mono text-on-surface/60">
                  {daysLeft > 0
                    ? `Faltam ${daysLeft} dia${daysLeft === 1 ? "" : "s"}`
                    : daysLeft === 0
                      ? "É hoje!"
                      : `${Math.abs(daysLeft)} dia${Math.abs(daysLeft) === 1 ? "" : "s"} após a DPP`}
                  {trimester && <span className="text-on-surface/40"> · {trimester}º trimestre</span>}
                </p>
              )}
              {pregnancy.notes && (
                <p className="text-[11px] font-mono text-on-surface/40 mt-1 truncate">{pregnancy.notes}</p>
              )}
              {currentWeek !== null && (
                <div className="mt-2 h-1.5 bg-bg rounded-full overflow-hidden w-full">
                  <div
                    className="h-full bg-health rounded-full transition-all"
                    style={{ width: `${Math.min(100, (currentWeek / 40) * 100)}%` }}
                  />
                </div>
              )}
              {nextMilestone && (
                <p className="text-[9px] font-mono text-on-surface/40 mt-1.5">
                  Próximo marco: semana {nextMilestone.week} — {nextMilestone.label}
                </p>
              )}
            </div>
          </div>

          {prenatalAppointments.length > 0 && (
            <div className="border-t border-border">
              <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
                <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
                  EXAMES PRÉ-NATAIS
                </span>
              </div>
              <div className="divide-y divide-border">
                {prenatalAppointments.map((a) => {
                  const isPast = new Date(a.starts_at) < new Date()
                  const date = new Date(a.starts_at)
                  return (
                    <div
                      key={a.id}
                      className={cn("flex items-center gap-3 h-9 px-4", isPast && "opacity-40")}
                    >
                      <span className="text-[10px] font-mono text-on-surface/40 w-14 flex-none">
                        {date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
                      </span>
                      <span className="flex-1 text-[11px] font-mono text-on-surface truncate">{a.title}</span>
                      {isPast && <span className="text-[9px] font-mono text-health flex-none">✓</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
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
