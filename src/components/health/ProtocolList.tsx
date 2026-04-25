"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProtocols, useCreateProtocol, useLogProtocolEntry, useProtocolEntries } from "@/lib/queries/health"
import { cn } from "@/lib/utils"

interface AddProtocolDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddProtocolDialog({ open, onOpenChange }: AddProtocolDialogProps) {
  const [name, setName] = useState("")
  const create = useCreateProtocol()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await create.mutateAsync({ name: name.trim(), active: true })
    setName("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="bg-surface border-border max-w-sm p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            NOVO PROTOCOLO
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Ácido fólico, Vitamina D, Caminhada diária"
            required
            autoFocus
            className="w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-[#A8D8B0] transition-colors"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="h-8 px-4 text-[10px] font-mono text-on-surface/40 hover:text-on-surface/70 transition-colors">CANCELAR</button>
            <button type="submit" disabled={create.isPending} className="h-8 px-4 border border-[#A8D8B0] text-[#A8D8B0] font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-[#A8D8B0]/20 disabled:opacity-30 transition-colors">
              {create.isPending ? "CRIANDO..." : "CRIAR →"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProtocolRow({ protocol }: { protocol: { id: string; name: string; active: boolean } }) {
  const { data: entries = [] } = useProtocolEntries(protocol.id)
  const logEntry = useLogProtocolEntry()
  const today = new Date().toISOString().slice(0, 10)
  const doneToday = entries.some((e) => e.done_on === today)
  const streak = entries.filter((e) => {
    const d = new Date(today)
    d.setDate(d.getDate() - entries.indexOf(e))
    return e.done_on === d.toISOString().slice(0, 10)
  }).length

  async function handleCheck() {
    if (doneToday) return
    await logEntry.mutateAsync({ protocol_id: protocol.id, done_on: today, notes: null })
  }

  return (
    <div className="flex items-center gap-3 h-10 px-4 hover:bg-surface-hover transition-colors">
      <button
        onClick={handleCheck}
        disabled={doneToday || logEntry.isPending}
        className={cn(
          "flex-none w-3.5 h-3.5 rounded-[3px] border transition-colors",
          doneToday
            ? "bg-[#A8D8B0] border-[#A8D8B0] flex items-center justify-center"
            : "border-on-surface/30 hover:border-[#A8D8B0]"
        )}
        aria-label={doneToday ? "Feito hoje" : "Marcar como feito"}
      >
        {doneToday && (
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-bg">
            <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <span className={cn("flex-1 text-[12px] font-mono truncate", doneToday ? "text-on-surface/40 line-through" : "text-on-surface")}>
        {protocol.name}
      </span>
      {streak > 1 && (
        <span className="flex-none text-[9px] font-mono text-amber tracking-wider">
          {streak}d
        </span>
      )}
      <span className={cn(
        "flex-none text-[8px] font-mono px-1.5 h-4 flex items-center rounded-[2px] border tracking-wider uppercase",
        doneToday ? "text-[#A8D8B0] border-[#A8D8B0]/40 bg-[#A8D8B0]/10" : "text-on-surface/20 border-border"
      )}>
        {doneToday ? "OK" : "PND"}
      </span>
    </div>
  )
}

export function ProtocolList() {
  const { data: protocols = [], isLoading } = useProtocols()
  const active = protocols.filter((p) => p.active)

  if (isLoading) return <div className="border border-border bg-surface rounded-sm h-32 animate-pulse" />

  if (active.length === 0) {
    return (
      <div className="border border-border bg-surface rounded-sm p-6 flex items-center justify-center">
        <span className="text-[11px] font-mono text-on-surface/20">Nenhum protocolo ativo</span>
      </div>
    )
  }

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">PROTOCOLOS DIÁRIOS</span>
      </div>
      <div className="divide-y divide-border">
        {active.map((p) => <ProtocolRow key={p.id} protocol={p} />)}
      </div>
    </div>
  )
}
