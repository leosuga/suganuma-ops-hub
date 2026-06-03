"use client"

import { useState } from "react"
import Link from "next/link"
import { useCreateTask } from "@/lib/queries/tasks"
import { useDailyNote, useCreateNote, useUpdateNote } from "@/lib/queries/notes"
import { parseFrontmatter } from "@/lib/frontmatter"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface DayDetailModalProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  date: string | null
  label: string
  entries: { appts: { title: string; time: string; kind?: string }[]; tasks: { title: string; priority: string }[]; meals: string[] } | null | undefined
}

export function DayDetailModal({ open, onOpenChange, date, label, entries }: DayDetailModalProps) {
  const [taskInput, setTaskInput] = useState("")
  const [noteInput, setNoteInput] = useState("")
  const [noteEditing, setNoteEditing] = useState(false)
  const createTask = useCreateTask()
  const { data: dailyNote } = useDailyNote(date ?? "")
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()

  async function handleQuickTask(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !taskInput.trim()) return
    await createTask.mutateAsync({
      title: taskInput.trim(),
      category: "personal",
      priority: "med",
      status: "todo",
      due_at: new Date(date + "T23:59:00").toISOString(),
    })
    setTaskInput("")
  }

  async function handleDailyNoteSave() {
    if (!date || !noteInput.trim()) return
    if (dailyNote) {
      await updateNote.mutateAsync({ id: dailyNote.id, content: noteInput.trim() })
    } else {
      await createNote.mutateAsync({
        title: date,
        content: noteInput.trim(),
        tags: ["daily"],
        pinned: false,
        daily_date: date,
      })
    }
    setNoteEditing(false)
  }

  const dailyNoteContent = dailyNote ? parseFrontmatter(dailyNote.content ?? "").body : ""

  if (!date) return null
  const isPast = date < new Date().toISOString().slice(0, 10)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-md p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase capitalize">{label}</DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-4">
          {dailyNote && !noteEditing && (
            <div>
              <span className="text-[9px] font-mono font-semibold tracking-widest text-amber uppercase block mb-1">Nota do dia</span>
              <div className="text-[11px] font-mono text-on-surface/60 whitespace-pre-wrap">{dailyNoteContent || "Nota vazia"}</div>
              <button onClick={() => { setNoteInput(dailyNote.content ?? ""); setNoteEditing(true) }} className="text-[9px] font-mono text-teal/60 hover:text-teal mt-1">editar →</button>
            </div>
          )}

          {noteEditing && (
            <div className="space-y-2">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-amber uppercase block">Nota do dia</span>
              <textarea
                value={noteInput}
                onChange={(e) => setNoteInput(e.target.value)}
                placeholder="Escreva a nota do dia..."
                rows={4}
                className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors resize-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setNoteEditing(false)} className="h-7 px-3 text-[9px] font-mono text-on-surface/40 hover:text-on-surface/60 transition-colors">CANCELAR</button>
                <button onClick={handleDailyNoteSave} disabled={updateNote.isPending || createNote.isPending} className="h-7 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors">
                  {updateNote.isPending || createNote.isPending ? "..." : "SALVAR"}
                </button>
              </div>
            </div>
          )}

          {!dailyNote && !noteEditing && (
            <button onClick={() => setNoteEditing(true)} className="text-[9px] font-mono text-on-surface/30 hover:text-amber transition-colors">
              + Criar nota do dia
            </button>
          )}

          {entries ? (
            <div className="space-y-3">
              {entries.appts.length > 0 && (
                <div>
                  <span className="text-[9px] font-mono font-semibold tracking-widest text-health uppercase block mb-1">Consultas</span>
                  {entries.appts.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] font-mono text-on-surface/60">
                      <span className="text-health tabular-nums w-12">{a.time}</span>
                      <span>{a.title}</span>
                      {a.kind && <span className="text-on-surface/30">{a.kind}</span>}
                    </div>
                  ))}
                </div>
              )}
              {entries.tasks.length > 0 && (
                <div>
                  <span className="text-[9px] font-mono font-semibold tracking-widest text-teal uppercase block mb-1">Tasks</span>
                  {entries.tasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px] font-mono">
                      <span className={cn("w-12 text-right", t.priority === "urgent" ? "text-danger" : "text-teal")}>{t.priority === "urgent" ? "URG" : t.priority.toUpperCase()}</span>
                      <span className="text-on-surface/60 truncate">{t.title}</span>
                    </div>
                  ))}
                </div>
              )}
              {entries.meals.length > 0 && (
                <div>
                  <span className="text-[9px] font-mono font-semibold tracking-widest text-amber uppercase block mb-1">Refeições</span>
                  {entries.meals.map((m, i) => (
                    <div key={i} className="text-[11px] font-mono text-on-surface/60">{m}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] font-mono text-on-surface/20">Nenhum evento neste dia</p>
          )}

          {!isPast && (
            <form onSubmit={handleQuickTask} className="flex items-center gap-2">
              <input
                type="text"
                value={taskInput}
                onChange={(e) => setTaskInput(e.target.value)}
                placeholder="Adicionar task para este dia..."
                className="flex-1 h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
              />
              <button type="submit" disabled={!taskInput.trim() || createTask.isPending} className="h-8 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors flex-none">
                {createTask.isPending ? "..." : "+ ADD"}
              </button>
            </form>
          )}

          <div className="flex gap-2">
            <Link href="/tasks" onClick={() => onOpenChange(false)} className="text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">TASKS →</Link>
            <Link href="/health" onClick={() => onOpenChange(false)} className="text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">HEALTH →</Link>
            <Link href="/meals" onClick={() => onOpenChange(false)} className="text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">MEALS →</Link>
            <Link href="/notes" onClick={() => onOpenChange(false)} className="text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">NOTES →</Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
