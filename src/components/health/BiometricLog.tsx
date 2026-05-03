"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useHealthLogs, useCreateHealthLog } from "@/lib/queries/health"
import type { HealthLogKind } from "@/lib/schemas/health"
import { cn } from "@/lib/utils"

const KINDS: Array<{ value: HealthLogKind; label: string; unit: string; fields: Array<{ key: string; placeholder: string }> }> = [
  { value: "weight", label: "PESO", unit: "kg", fields: [{ key: "kg", placeholder: "Ex: 68.5" }] },
  { value: "blood_pressure", label: "PRESSÃO", unit: "mmHg", fields: [{ key: "systolic", placeholder: "Sistólica" }, { key: "diastolic", placeholder: "Diastólica" }] },
  { value: "glucose", label: "GLICEMIA", unit: "mg/dL", fields: [{ key: "mg_dl", placeholder: "Ex: 95" }] },
  { value: "heart_rate", label: "FREQUÊNCIA", unit: "bpm", fields: [{ key: "bpm", placeholder: "Ex: 72" }] },
]

function formatValue(kind: string, value: Record<string, unknown>): string {
  if (kind === "weight") return `${value.kg} kg`
  if (kind === "blood_pressure") return `${value.systolic}/${value.diastolic} mmHg`
  if (kind === "glucose") return `${value.mg_dl} mg/dL`
  if (kind === "heart_rate") return `${value.bpm} bpm`
  return JSON.stringify(value)
}

interface BiometricLogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BiometricLogDialog({ open, onOpenChange }: BiometricLogProps) {
  const [kind, setKind] = useState<HealthLogKind>("weight")
  const [fields, setFields] = useState<Record<string, string>>({})
  const create = useCreateHealthLog()

  const selectedKind = KINDS.find((k) => k.value === kind)!

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const value: Record<string, number> = {}
    for (const f of selectedKind.fields) {
      const v = parseFloat(fields[f.key]?.replace(",", ".") ?? "")
      if (!v) return
      value[f.key] = v
    }
    await create.mutateAsync({ kind, value })
    setFields({})
    onOpenChange(false)
  }

  const inputClass = "w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-health transition-colors"

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="bg-surface border-border max-w-sm p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            REGISTRAR BIOMETRIA
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => { setKind(k.value); setFields({}) }}
                className={cn(
                  "h-7 text-[8px] font-mono font-semibold tracking-wider rounded-sm border transition-colors",
                  kind === k.value
                    ? "border-health bg-health/10 text-health"
                    : "border-border text-on-surface/30 hover:border-on-surface/40"
                )}
              >
                {k.label}
              </button>
            ))}
          </div>
          {selectedKind.fields.map((f) => (
            <input
              key={f.key}
              type="text"
              inputMode="decimal"
              value={fields[f.key] ?? ""}
              onChange={(e) => setFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              required
              autoFocus
              className={inputClass}
            />
          ))}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="h-8 px-4 text-[10px] font-mono text-on-surface/40 hover:text-on-surface/70 transition-colors">
              CANCELAR
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="h-8 px-4 border border-health text-health font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-health/20 disabled:opacity-30 transition-colors"
            >
              {create.isPending ? "SALVANDO..." : "SALVAR →"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function BiometricList() {
  const { data: logs = [], isLoading } = useHealthLogs()

  if (isLoading) {
    return <div className="border border-border bg-surface rounded-sm h-32 animate-pulse" />
  }

  if (logs.length === 0) {
    return (
      <div className="border border-border bg-surface rounded-sm p-6 flex items-center justify-center">
        <span className="text-[11px] font-mono text-on-surface/20">Nenhum registro ainda</span>
      </div>
    )
  }

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center gap-3 border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase w-24">TIPO</span>
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase flex-1">VALOR</span>
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase w-24 text-right">DATA</span>
      </div>
      <div className="divide-y divide-border">
        {logs.map((log) => {
          const kind = KINDS.find((k) => k.value === log.kind)
          const dateStr = new Date(log.logged_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })
          return (
            <div key={log.id} className="flex items-center gap-3 h-10 px-4 hover:bg-surface-hover transition-colors">
              <span className="text-[9px] font-mono text-on-surface/40 uppercase tracking-wider w-24">
                {kind?.label ?? log.kind}
              </span>
              <span className="flex-1 text-[12px] font-mono text-health tabular-nums">
                {formatValue(log.kind, log.value as Record<string, unknown>)}
              </span>
              <span className="text-[10px] font-mono text-on-surface/30 w-24 text-right">{dateStr}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
