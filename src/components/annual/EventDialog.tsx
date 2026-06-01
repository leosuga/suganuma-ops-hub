"use client"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useProjects } from "@/lib/queries/projects"
import { ANNUAL_COLORS } from "@/lib/annual-colors"
import type { AnnualEventRow } from "@/lib/types"
import { useState, useEffect } from "react"

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialEvent: AnnualEventRow | null
  initialDate: string | null
  onSave: (title: string, start: string, end: string, color: string, recurrence: string, projectId: string | null) => void
  onDelete?: () => void
  onClone?: (title: string, start: string, end: string, color: string, recurrence: string, projectId: string | null) => void
  onSaveSeries?: (seriesId: string, title: string, start: string, end: string, color: string, projectId: string | null) => void
  onDeleteSeries?: (seriesId: string) => void
}

export function EventDialog({ open, onOpenChange, initialEvent, initialDate, onSave, onDelete, onClone }: EventDialogProps) {
  const [title, setTitle] = useState("")
  const [start, setStart] = useState("")
  const [end, setEnd] = useState("")
  const [color, setColor] = useState(ANNUAL_COLORS[0])
  const [recurrence, setRecurrence] = useState("none")
  const [projectId, setProjectId] = useState<string | null>(null)
  const { data: projects = [] } = useProjects()

  const isEditing = !!initialEvent

  useEffect(() => {
    if (initialEvent) {
      setTitle(initialEvent.title)
      setStart(initialEvent.start_date)
      setEnd(initialEvent.end_date)
      setColor(initialEvent.color)
      setRecurrence(initialEvent.recurrence || "none")
      setProjectId(initialEvent.project_id || null)
    } else if (initialDate) {
      setTitle("")
      setStart(initialDate)
      setEnd(initialDate)
      setColor(ANNUAL_COLORS[0])
      setRecurrence("none")
      setProjectId(null)
    }
  }, [initialEvent, initialDate, open])

  function shiftDate(dateStr: string, days: number): string {
    const d = new Date(dateStr + "T00:00:00")
    d.setDate(d.getDate() + days)
    return d.toISOString().slice(0, 10)
  }

  function shiftMonth(dateStr: string, months: number): string {
    const d = new Date(dateStr + "T00:00:00")
    d.setMonth(d.getMonth() + months)
    return d.toISOString().slice(0, 10)
  }

  function handleShift(days: number) {
    if (!start || !end) return
    const duration = new Date(end + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime()
    const newStart = shiftDate(start, days)
    const newStartDate = new Date(newStart + "T00:00:00")
    const newEndDate = new Date(newStartDate.getTime() + duration)
    const newEnd = newEndDate.toISOString().slice(0, 10)
    setStart(newStart)
    setEnd(newEnd)
  }

  function handleShiftMonth(months: number) {
    if (!start || !end) return
    const duration = new Date(end + "T00:00:00").getTime() - new Date(start + "T00:00:00").getTime()
    const newStart = shiftMonth(start, months)
    const newStartDate = new Date(newStart + "T00:00:00")
    const newEndDate = new Date(newStartDate.getTime() + duration)
    const newEnd = newEndDate.toISOString().slice(0, 10)
    setStart(newStart)
    setEnd(newEnd)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !start || !end) return
    const s = new Date(start + "T00:00:00")
    const en = new Date(end + "T00:00:00")
    if (en < s) {
      onSave(title.trim(), end, start, color, recurrence, projectId)
    } else {
      onSave(title.trim(), start, end, color, recurrence, projectId)
    }
    setTitle("")
    setStart("")
    setEnd("")
    setRecurrence("none")
    setProjectId(null)
    onOpenChange(false)
  }

  function handleDelete() {
    if (onDelete) {
      onDelete()
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="font-mono text-[11px] tracking-wider uppercase">
              {isEditing ? "Editar Evento" : "Novo Evento"}
            </DialogTitle>
            <DialogDescription />
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <label className="text-[9px] font-mono text-on-surface/50 uppercase tracking-wider">
                Título
              </label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] font-mono text-on-surface/50 uppercase tracking-wider">
                  Início
                </label>
                <Input
                  type="date"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value)
                    if (!end || new Date(e.target.value + "T00:00:00") > new Date(end + "T00:00:00")) {
                      setEnd(e.target.value)
                    }
                  }}
                  required
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] font-mono text-on-surface/50 uppercase tracking-wider">
                  Fim
                </label>
                <Input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Shift controls */}
            {isEditing && (
              <div className="flex items-center gap-1">
                <span className="text-[9px] font-mono text-on-surface/40 mr-1">Shift:</span>
                {[-7, -1, 1, 7].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleShift(d)}
                    className="px-1.5 py-0.5 text-[8px] font-mono bg-surface border border-border/40 rounded-sm hover:bg-surface/80 text-on-surface/60"
                  >
                    {d > 0 ? `+${d}` : d}d
                  </button>
                ))}
                <span className="text-on-surface/20 mx-0.5">|</span>
                {[-1, 1].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleShiftMonth(m)}
                    className="px-1.5 py-0.5 text-[8px] font-mono bg-surface border border-border/40 rounded-sm hover:bg-surface/80 text-on-surface/60"
                  >
                    {m > 0 ? `+${m}` : m}m
                  </button>
                ))}
              </div>
            )}

            <div>
              <label className="text-[9px] font-mono text-on-surface/50 uppercase tracking-wider">
                Cor
              </label>
              <div className="flex gap-2 flex-wrap mt-1">
                {ANNUAL_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={cn(
                      "w-6 h-6 rounded-full border transition-all",
                      color === c ? "border-white scale-110 ring-2 ring-white/50" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                    onClick={() => setColor(c)}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="text-[9px] font-mono text-on-surface/50 uppercase tracking-wider">
                Recorrência
              </label>
              <div className="flex gap-2 mt-1">
                {[
                  { value: "none", label: "Nenhuma" },
                  { value: "weekly", label: "Semanal" },
                  { value: "monthly", label: "Mensal" },
                  { value: "yearly", label: "Anual" },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={cn(
                      "px-2 py-1 text-[9px] font-mono rounded-sm border transition-all",
                      recurrence === option.value
                        ? "border-teal text-teal bg-teal/10"
                        : "border-border/40 text-on-surface/40 hover:text-on-surface/60"
                    )}
                    onClick={() => setRecurrence(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[9px] font-mono text-on-surface/50 uppercase tracking-wider">
                Projeto
              </label>
              <select
                value={projectId || ""}
                onChange={(e) => setProjectId(e.target.value || null)}
                className="mt-1 w-full bg-surface border border-border/50 rounded-sm px-2 py-1.5 text-[10px] font-mono text-on-surface focus:outline-none focus:border-teal/50"
              >
                <option value="">Nenhum</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <div className="flex w-full items-center justify-between">
              <div className="flex gap-2">
                {isEditing && onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                    className="bg-danger/20 hover:bg-danger/30 text-danger border-danger/30"
                  >
                    Excluir
                  </Button>
                )}
                {isEditing && onClone && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!title.trim() || !start || !end) return
                      onClone(title.trim(), start, end, color, recurrence, projectId)
                      onOpenChange(false)
                    }}
                    className="border-border/40 text-on-surface/60 hover:text-on-surface"
                  >
                    Clonar
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} size="sm">
                  Cancelar
                </Button>
                <Button type="submit" size="sm" className="bg-teal hover:bg-teal-hi text-black font-semibold">
                  Salvar
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
