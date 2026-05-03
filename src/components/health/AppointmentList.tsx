"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useAppointments, useCreateAppointment, useDeleteAppointment } from "@/lib/queries/health"
import { cn } from "@/lib/utils"

interface AddAppointmentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AddAppointmentDialog({ open, onOpenChange }: AddAppointmentDialogProps) {
  const [title, setTitle] = useState("")
  const [startsAt, setStartsAt] = useState("")
  const [location, setLocation] = useState("")
  const [kind, setKind] = useState("")
  const create = useCreateAppointment()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !startsAt) return
    await create.mutateAsync({
      title: title.trim(),
      starts_at: new Date(startsAt).toISOString(),
      location: location.trim() || null,
      kind: kind.trim() || null,
    })
    setTitle(""); setStartsAt(""); setLocation(""); setKind("")
    onOpenChange(false)
  }

  const inputClass = "w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-health transition-colors"

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="bg-surface border-border max-w-md p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            NOVO AGENDAMENTO
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-3">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título (ex: Consulta pré-natal)" required autoFocus className={inputClass} />
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required className={inputClass} />
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Local (opcional)" className={inputClass} />
          <input type="text" value={kind} onChange={(e) => setKind(e.target.value)} placeholder="Tipo (ex: consulta, exame, ultrassom)" className={inputClass} />
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => onOpenChange(false)} className="h-8 px-4 text-[10px] font-mono text-on-surface/40 hover:text-on-surface/70 transition-colors">CANCELAR</button>
            <button type="submit" disabled={create.isPending} className="h-8 px-4 border border-health text-health font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-health/20 disabled:opacity-30 transition-colors">
              {create.isPending ? "SALVANDO..." : "SALVAR →"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AppointmentList() {
  const { data: appointments = [], isLoading } = useAppointments()
  const deleteAppt = useDeleteAppointment()
  const now = new Date()

  const upcoming = appointments.filter((a) => new Date(a.starts_at) >= now)
  const past = appointments.filter((a) => new Date(a.starts_at) < now)

  if (isLoading) return <div className="border border-border bg-surface rounded-sm h-32 animate-pulse" />

  if (appointments.length === 0) {
    return (
      <div className="border border-border bg-surface rounded-sm p-6 flex items-center justify-center">
        <span className="text-[11px] font-mono text-on-surface/20">Nenhum agendamento</span>
      </div>
    )
  }

  const renderRow = (appt: typeof appointments[0], isPast: boolean) => {
    const date = new Date(appt.starts_at)
    const dateStr = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
    const timeStr = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    return (
      <div key={appt.id} className={cn("flex items-center gap-3 h-10 px-4 hover:bg-surface-hover transition-colors", isPast && "opacity-40")}>
        <span className="text-[10px] font-mono text-on-surface/40 w-14 flex-none">{dateStr} {timeStr}</span>
        <span className="flex-1 text-[12px] font-mono text-on-surface truncate">{appt.title}</span>
        {appt.kind && <span className="text-[9px] font-mono text-on-surface/30 uppercase tracking-wider flex-none">{appt.kind}</span>}
        {appt.location && <span className="text-[10px] font-mono text-on-surface/30 flex-none truncate max-w-[100px]">{appt.location}</span>}
        <button onClick={() => deleteAppt.mutate(appt.id)} className="flex-none w-6 h-6 flex items-center justify-center text-on-surface/20 hover:text-danger transition-colors">×</button>
      </div>
    )
  }

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">AGENDAMENTOS</span>
      </div>
      <div className="divide-y divide-border">
        {upcoming.map((a) => renderRow(a, false))}
        {past.slice(0, 5).map((a) => renderRow(a, true))}
      </div>
    </div>
  )
}
