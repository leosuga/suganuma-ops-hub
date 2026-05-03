"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useUpdateTask, useDeleteTask } from "@/lib/queries/tasks"
import type { TaskRow } from "@/lib/queries/tasks"
import { cn } from "@/lib/utils"

type Category = "finance" | "logistics" | "personal" | "health"
type Priority = "low" | "med" | "high" | "urgent"
type Status = "todo" | "doing" | "done" | "archived"

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "personal", label: "PERSONAL" },
  { value: "finance", label: "FINANCE" },
  { value: "logistics", label: "LOGISTICS" },
  { value: "health", label: "HEALTH" },
]

const PRIORITY_OPTIONS: { value: Priority; label: string }[] = [
  { value: "low", label: "LOW" },
  { value: "med", label: "MED" },
  { value: "high", label: "HIGH" },
  { value: "urgent", label: "URG" },
]

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: "todo", label: "TODO" },
  { value: "doing", label: "DOING" },
  { value: "done", label: "DONE" },
  { value: "archived", label: "ARCHIVED" },
]

interface EditTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskRow | null
}

export function EditTaskDialog({ open, onOpenChange, task }: EditTaskDialogProps) {
  const [title, setTitle] = useState("")
  const [notes, setNotes] = useState("")
  const [category, setCategory] = useState<Category>("personal")
  const [priority, setPriority] = useState<Priority>("med")
  const [status, setStatus] = useState<Status>("todo")
  const [dueAt, setDueAt] = useState("")
  const [confirmDelete, setConfirmDelete] = useState(false)

  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  useEffect(() => {
    if (task) {
      setTitle(task.title ?? "")
      setNotes(task.notes ?? "")
      setCategory(task.category as Category)
      setPriority(task.priority as Priority)
      setStatus(task.status as Status)
      if (task.due_at) {
        const d = new Date(task.due_at)
        setDueAt(d.toISOString().slice(0, 16))
      } else {
        setDueAt("")
      }
      setConfirmDelete(false)
    }
  }, [task])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!task || !title.trim()) return

    const updates: {
      id: string
      title: string
      notes?: string | undefined
      category: Category
      priority: Priority
      status: Status
      due_at?: string | undefined
      completed_at?: string | null
    } = {
      id: task.id,
      title: title.trim(),
      notes: notes.trim() || undefined,
      category,
      priority,
      status,
      due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
    }

    if (status === "done" && task.status !== "done") {
      updates.completed_at = new Date().toISOString()
    } else if (status !== "done" && task.status === "done") {
      updates.completed_at = null
    }

    await updateTask.mutateAsync(updates)
    onOpenChange(false)
  }

  async function handleDelete() {
    if (!task) return
    await deleteTask.mutateAsync(task.id)
    onOpenChange(false)
  }

  const inputClass = "w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="bg-surface border-border max-w-lg p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            EDITAR TASK
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              Título
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da task"
              autoFocus
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              Notas
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas, links, contexto..."
              rows={3}
              className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors resize-none"
            />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              Data limite
            </span>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              Categoria
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {CATEGORY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  className={cn(
                    "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-wider border transition-colors",
                    category === opt.value
                      ? "bg-teal/15 text-teal border-teal/40"
                      : "text-on-surface/40 border-border hover:border-on-surface/30"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              Status
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={cn(
                    "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-wider border transition-colors",
                    status === opt.value
                      ? "bg-teal/15 text-teal border-teal/40"
                      : "text-on-surface/40 border-border hover:border-on-surface/30"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              Prioridade
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={cn(
                    "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-wider border transition-colors",
                    priority === opt.value
                      ? "bg-teal/15 text-teal border-teal/40"
                      : "text-on-surface/40 border-border hover:border-on-surface/30"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-danger">Confirmar exclusão?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="h-7 px-3 border border-danger text-danger font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-danger/10 transition-colors"
                >
                  SIM, DELETAR
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="h-7 px-3 text-[10px] font-mono text-on-surface/40 hover:text-on-surface/60 transition-colors"
                >
                  NÃO
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="h-7 px-3 text-[9px] font-mono text-on-surface/20 hover:text-danger transition-colors"
              >
                DELETAR TASK
              </button>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-8 px-3 font-mono text-[10px] tracking-wider text-on-surface/40 hover:text-on-surface/60 transition-colors"
              >
                CANCELAR
              </button>
              <button
                type="submit"
                disabled={!title.trim() || updateTask.isPending}
                className="h-8 px-4 bg-teal/10 border border-teal text-teal font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
              >
                {updateTask.isPending ? "SALVANDO..." : "SALVAR →"}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
