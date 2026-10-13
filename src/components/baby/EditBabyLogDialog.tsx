"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useUpdateBabyLog, type BabyLogRow } from "@/lib/queries/baby"
import { formatLogLine, toLocalInput, fromLocalInput } from "@/lib/baby/quick-log"

const inputClass =
  "w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface focus:outline-none focus:border-health transition-colors"
const labelClass = "text-[9px] font-mono text-on-surface/40 uppercase tracking-widest block mb-1"

interface EditBabyLogDialogProps {
  log: BabyLogRow | null
  onOpenChange: (open: boolean) => void
}

// O form só monta quando há um registro (key = id), então o estado inicial
// vem direto das props e não precisa de useEffect para sincronizar.
export function EditBabyLogDialog({ log, onOpenChange }: EditBabyLogDialogProps) {
  return (
    <Dialog open={!!log} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="bg-surface border-border max-w-sm p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            EDITAR REGISTRO
          </DialogTitle>
        </DialogHeader>
        {log && <EditForm key={log.id} log={log} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function EditForm({ log, onClose }: { log: BabyLogRow; onClose: () => void }) {
  const update = useUpdateBabyLog()
  const [start, setStart] = useState(toLocalInput(log.started_at))
  const [end, setEnd] = useState(log.ended_at ? toLocalInput(log.ended_at) : "")
  const [side, setSide] = useState(typeof log.data.side === "string" ? log.data.side : "")
  const [ml, setMl] = useState(typeof log.data.ml === "number" ? String(log.data.ml) : "")
  const [notes, setNotes] = useState(log.notes ?? "")
  const [error, setError] = useState("")

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const startedAt = fromLocalInput(start)
    const endedAt = end ? fromLocalInput(end) : null
    if (!startedAt || (end && !endedAt)) {
      setError("Data ou hora inválida.")
      return
    }
    if (endedAt && endedAt < startedAt) {
      setError("O fim precisa ser depois do início.")
      return
    }
    const data = { ...log.data }
    if (log.kind === "feed") {
      if (side) data.side = side
      const n = parseInt(ml, 10)
      if (log.data.method === "bottle" && Number.isFinite(n) && n > 0) data.ml = n
    }
    await update.mutateAsync({
      id: log.id,
      started_at: startedAt,
      ended_at: log.kind === "sleep" ? endedAt : log.ended_at,
      data,
      notes: notes.trim() || null,
    })
    onClose()
  }

  return (
    <form onSubmit={handleSave} className="p-4 flex flex-col gap-3">
      <p className="text-[11px] font-mono text-on-surface/60">{formatLogLine(log)}</p>
      <div>
        <label className={labelClass}>Início</label>
        <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
      </div>
      {log.kind === "sleep" && (
        <div>
          <label className={labelClass}>Fim (vazio = ainda dormindo)</label>
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
        </div>
      )}
      {log.kind === "feed" && log.data.method === "breast" && (
        <div>
          <label className={labelClass}>Lado</label>
          <select value={side} onChange={(e) => setSide(e.target.value)} className={inputClass}>
            <option value="L">Esquerdo</option>
            <option value="R">Direito</option>
            <option value="both">Ambos</option>
          </select>
        </div>
      )}
      {log.kind === "feed" && log.data.method === "bottle" && (
        <div>
          <label className={labelClass}>ml</label>
          <input inputMode="numeric" value={ml} onChange={(e) => setMl(e.target.value)} className={inputClass} />
        </div>
      )}
      <div>
        <label className={labelClass}>Notas</label>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </div>
      {error && <p className="text-[11px] font-mono text-danger">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-8 px-4 text-[10px] font-mono text-on-surface/40 hover:text-on-surface/70">CANCELAR</button>
        <button type="submit" disabled={update.isPending} className="h-8 px-4 border border-health text-health font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-health/20 disabled:opacity-30">
          {update.isPending ? "SALVANDO..." : "SALVAR →"}
        </button>
      </div>
    </form>
  )
}
