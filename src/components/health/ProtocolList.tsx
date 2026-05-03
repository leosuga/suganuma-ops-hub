"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useProtocols, useCreateProtocol, useLogProtocolEntry, useProtocolEntries, useUpdateProtocol, useDeleteProtocol } from "@/lib/queries/health"
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
            className="w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-health transition-colors"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => onOpenChange(false)} className="h-8 px-4 text-[10px] font-mono text-on-surface/40 hover:text-on-surface/70 transition-colors">CANCELAR</button>
            <button type="submit" disabled={create.isPending} className="h-8 px-4 border border-health text-health font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-health/20 disabled:opacity-30 transition-colors">
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
  const updateProtocol = useUpdateProtocol()
  const deleteProtocol = useDeleteProtocol()
  const today = new Date().toISOString().slice(0, 10)
  const doneToday = entries.some((e) => e.done_on === today)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(protocol.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const sortedDates = entries
    .map((e) => e.done_on)
    .filter((d) => d <= today)
    .sort((a, b) => b.localeCompare(a))

  let streak = 0
  const checkDate = new Date(today + "T12:00:00")
  for (const d of sortedDates) {
    const expected = checkDate.toISOString().slice(0, 10)
    if (d === expected) {
      streak++
      checkDate.setDate(checkDate.getDate() - 1)
    } else if (d < expected) {
      break
    }
  }

  async function handleCheck() {
    if (doneToday) return
    await logEntry.mutateAsync({ protocol_id: protocol.id, done_on: today, notes: null })
  }

  async function handleSaveEdit() {
    if (!editName.trim()) return
    await updateProtocol.mutateAsync({ id: protocol.id, name: editName.trim() })
    setEditing(false)
  }

  async function handleToggleActive() {
    await updateProtocol.mutateAsync({ id: protocol.id, active: !protocol.active })
  }

  async function handleDelete() {
    await deleteProtocol.mutateAsync(protocol.id)
  }

  return (
    <div className="flex items-center gap-3 h-10 px-4 hover:bg-surface-hover transition-colors">
      {editing ? (
        <>
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditing(false) }}
            autoFocus
            className="flex-1 h-7 bg-bg border border-border rounded-sm px-2 text-[12px] font-mono text-on-surface focus:outline-none focus:border-health transition-colors"
          />
          <button onClick={handleSaveEdit} disabled={updateProtocol.isPending} className="text-[9px] font-mono text-health hover:opacity-70 tracking-wider">OK</button>
          <button onClick={() => setEditing(false)} className="text-on-surface/30 hover:text-on-surface/60 text-[14px]">×</button>
        </>
      ) : (
        <>
          <button
            onClick={handleCheck}
            disabled={doneToday || logEntry.isPending}
            className={cn(
              "flex-none w-3.5 h-3.5 rounded-[3px] border transition-colors",
              doneToday
                ? "bg-health border-health flex items-center justify-center"
                : "border-on-surface/30 hover:border-health"
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
          {!protocol.active && (
            <span className="flex-none text-[8px] font-mono text-on-surface/20 uppercase tracking-wider">INATIVO</span>
          )}
          {streak > 1 && (
            <span className="flex-none text-[9px] font-mono text-amber tracking-wider">
              {streak}d
            </span>
          )}
          <span className={cn(
            "flex-none text-[8px] font-mono px-1.5 h-4 flex items-center rounded-[2px] border tracking-wider uppercase",
            doneToday ? "text-health border-health/40 bg-health/10" : "text-on-surface/20 border-border"
          )}>
            {doneToday ? "OK" : "PND"}
          </span>

          {confirmDelete ? (
            <>
              <button onClick={handleDelete} disabled={deleteProtocol.isPending} className="text-[9px] font-mono text-danger hover:opacity-70 tracking-wider">DEL</button>
              <button onClick={() => setConfirmDelete(false)} className="text-on-surface/30 hover:text-on-surface/60 text-[14px]">×</button>
            </>
          ) : (
            <>
              <button onClick={() => { setEditName(protocol.name); setEditing(true) }} className="w-5 h-5 flex items-center justify-center text-on-surface/20 hover:text-teal transition-colors text-[11px]" aria-label={`Editar protocolo: ${protocol.name}`}>✎</button>
              <button onClick={handleToggleActive} className={cn("text-[8px] font-mono tracking-wider", protocol.active ? "text-on-surface/20 hover:text-on-surface/50" : "text-teal hover:text-teal-hi")} title={protocol.active ? "Desativar" : "Ativar"}>
                {protocol.active ? "⊘" : "⊕"}
              </button>
              <button onClick={() => setConfirmDelete(true)} className="w-5 h-5 flex items-center justify-center text-on-surface/20 hover:text-danger transition-colors">×</button>
            </>
          )}
        </>
      )}
    </div>
  )
}

export function ProtocolList() {
  const { data: protocols = [], isLoading } = useProtocols()

  if (isLoading) return <div className="border border-border bg-surface rounded-sm h-32 animate-pulse" />

  if (protocols.length === 0) {
    return (
      <div className="border border-border bg-surface rounded-sm p-6 flex items-center justify-center">
        <span className="text-[11px] font-mono text-on-surface/20">Nenhum protocolo ainda</span>
      </div>
    )
  }

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">PROTOCOLOS DIÁRIOS</span>
      </div>
      <div className="divide-y divide-border">
        {protocols.map((p) => <ProtocolRow key={p.id} protocol={p} />)}
      </div>
    </div>
  )
}
