"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCreateBabyLog } from "@/lib/queries/baby"
import { babyLogSchema, type BabyLog } from "@/lib/schemas/baby"
import { cn } from "@/lib/utils"

type Kind = "med" | "temp" | "growth" | "note"

const KINDS: { value: Kind; label: string }[] = [
  { value: "med", label: "REMÉDIO" },
  { value: "temp", label: "TEMPERATURA" },
  { value: "growth", label: "MEDIDA" },
  { value: "note", label: "NOTA" },
]

const inputClass =
  "w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/60 focus:outline-none focus:border-health focus:ring-1 focus:ring-health/50 transition-colors"

function num(v: string): number | undefined {
  const n = parseFloat(v.replace(",", "."))
  return Number.isFinite(n) && n > 0 ? n : undefined
}

interface MoreLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  childId: string
}

export function MoreLogDialog({ open, onOpenChange, childId }: MoreLogDialogProps) {
  const create = useCreateBabyLog()
  const [kind, setKind] = useState<Kind>("med")
  const [f, setF] = useState<Record<string, string>>({})
  const [error, setError] = useState("")
  const set = (k: string, v: string) => setF((prev) => ({ ...prev, [k]: v }))

  function build(): BabyLog {
    switch (kind) {
      case "med":
        return { child_id: childId, kind, data: { name: (f.name ?? "").trim(), dose: f.dose?.trim() || undefined } }
      case "temp":
        return { child_id: childId, kind, data: { celsius: num(f.celsius ?? "") ?? NaN } }
      case "growth":
        return {
          child_id: childId,
          kind,
          data: { weight_g: num(f.weight_g ?? ""), length_cm: num(f.length_cm ?? ""), head_cm: num(f.head_cm ?? "") },
        }
      default:
        return { child_id: childId, kind: "note", data: {}, notes: (f.notes ?? "").trim() }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = babyLogSchema.safeParse(build())
    if (!parsed.success || (kind === "note" && !f.notes?.trim())) {
      setError("Confira os campos preenchidos.")
      return
    }
    setError("")
    await create.mutateAsync(parsed.data)
    setF({})
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="bg-surface border-border max-w-sm p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase">
            REGISTRAR
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => { setKind(k.value); setF({}); setError("") }}
                className={cn(
                  "min-h-[36px] text-[9px] font-mono font-semibold tracking-wider rounded-sm border transition-colors",
                  kind === k.value ? "border-health bg-health/10 text-health" : "border-border text-on-surface/60",
                )}
              >
                {k.label}
              </button>
            ))}
          </div>

          {kind === "med" && (
            <>
              <input className={inputClass} placeholder="Nome (ex: Vitamina D)" value={f.name ?? ""} onChange={(e) => set("name", e.target.value)} autoFocus />
              <input className={inputClass} placeholder="Dose (opcional)" value={f.dose ?? ""} onChange={(e) => set("dose", e.target.value)} />
            </>
          )}
          {kind === "temp" && (
            <input className={inputClass} inputMode="decimal" placeholder="°C (ex: 36,8)" value={f.celsius ?? ""} onChange={(e) => set("celsius", e.target.value)} autoFocus />
          )}
          {kind === "growth" && (
            <div className="grid grid-cols-3 gap-2">
              <input className={inputClass} inputMode="numeric" placeholder="Peso g" value={f.weight_g ?? ""} onChange={(e) => set("weight_g", e.target.value)} />
              <input className={inputClass} inputMode="decimal" placeholder="Compr. cm" value={f.length_cm ?? ""} onChange={(e) => set("length_cm", e.target.value)} />
              <input className={inputClass} inputMode="decimal" placeholder="PC cm" value={f.head_cm ?? ""} onChange={(e) => set("head_cm", e.target.value)} />
            </div>
          )}
          {kind === "note" && (
            <input className={inputClass} placeholder="Observação" value={f.notes ?? ""} onChange={(e) => set("notes", e.target.value)} autoFocus />
          )}

          {error && <p role="alert" className="text-[11px] font-mono text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="h-8 px-4 text-[10px] font-mono text-on-surface/60 hover:text-on-surface/70">CANCELAR</button>
            <button type="submit" disabled={create.isPending} className="h-8 px-4 border border-health text-health font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-health/20 disabled:opacity-30">
              {create.isPending ? "SALVANDO..." : "SALVAR →"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
