"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useUpdateTask, useDeleteTask } from "@/lib/queries/tasks"
import { useProjects } from "@/lib/queries/projects"
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
  const [projectId, setProjectId] = useState("")
  const [delegatedTo, setDelegatedTo] = useState("")
  const [important, setImportant] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { data: projects = [] } = useProjects()

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
      setProjectId(task.project_id ?? "")
      setDelegatedTo(task.delegated_to ?? "")
      setImportant(task.important ?? false)
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
      project_id?: string | null
      delegated_to?: string | null
      important?: boolean
    } = {
      id: task.id,
      title: title.trim(),
      notes: notes.trim() || undefined,
      category,
      priority,
      status,
      due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
      project_id: projectId || null,
      delegated_to: delegatedTo.trim() || null,
      important,
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
              Projeto
            </span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface focus:outline-none focus:border-teal transition-colors"
            >
              <option value="">Sem projeto</option>
              {projects.filter((p) => p.status === "active").map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              Delegado para
            </span>
            <input
              value={delegatedTo}
              onChange={(e) => setDelegatedTo(e.target.value)}
              placeholder="@Nome"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              Importante
            </span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={important}
                onChange={(e) => setImportant(e.target.checked)}
                className="w-3.5 h-3.5 rounded-[3px] border border-on-surface/30 bg-bg checked:bg-amber checked:border-amber focus:outline-none cursor-pointer"
              />
              <span className="text-[11px] font-mono text-on-surface/50">
                Marcar como importante (Eisenhower)
              </span>
            </label>
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
