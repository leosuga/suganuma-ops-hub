"use client"

import { useReducer, useEffect } from "react"
import Link from "next/link"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useUpdateTask, useDeleteTask } from "@/lib/queries/tasks"
import { useProjects } from "@/lib/queries/projects"
import { useNotes, useCreateNote } from "@/lib/queries/notes"
import type { TaskRow } from "@/lib/queries/tasks"
import { cn } from "@/lib/utils"

type Category = "finance" | "logistics" | "personal" | "health"
type Priority = "low" | "med" | "high" | "urgent"
type Status = "todo" | "doing" | "done" | "archived"
type EnergyLevel = "low" | "med" | "high"
type Recurrence = "" | "daily" | "weekly" | "monthly"

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

const ENERGY_OPTIONS: { value: EnergyLevel; label: string }[] = [
  { value: "low", label: "LOW" },
  { value: "med", label: "MED" },
  { value: "high", label: "HIGH" },
]

interface EditTaskDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: TaskRow | null
}

interface FormState {
  title: string
  taskNotes: string
  category: Category
  priority: Priority
  status: Status
  dueAt: string
  projectId: string
  delegatedTo: string
  important: boolean
  recurrence: Recurrence
  tagsInput: string
  energyLevel: EnergyLevel | ""
  confirmDelete: boolean
}

type Action =
  | { type: "field"; key: keyof FormState; value: string | boolean | EnergyLevel | "" }
  | { type: "reset"; state: FormState }

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "field":
      return { ...state, [action.key]: action.value }
    case "reset":
      return action.state
  }
}

const initialState: FormState = {
  title: "",
  taskNotes: "",
  category: "personal",
  priority: "med",
  status: "todo",
  dueAt: "",
  projectId: "",
  delegatedTo: "",
  important: false,
  recurrence: "",
  tagsInput: "",
  energyLevel: "",
  confirmDelete: false,
}

export function EditTaskDialog({ open, onOpenChange, task }: EditTaskDialogProps) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { data: projects = [] } = useProjects()
  const { data: notes = [] } = useNotes()
  const createNote = useCreateNote()

  const linkedNotes = notes.filter((n) => n.linked_task_id === task?.id)

  useEffect(() => {
    if (task) {
      dispatch({
        type: "reset",
        state: {
          title: task.title ?? "",
          taskNotes: task.notes ?? "",
          category: task.category as Category,
          priority: task.priority as Priority,
          status: task.status as Status,
          dueAt: task.due_at ? new Date(task.due_at).toISOString().slice(0, 16) : "",
          projectId: task.project_id ?? "",
          delegatedTo: task.delegated_to ?? "",
          important: task.important ?? false,
          recurrence: (task.recurrence as Recurrence | null) ?? "",
          tagsInput: (task.tags ?? []).join(" "),
          energyLevel: task.energy_level ?? "",
          confirmDelete: false,
        },
      })
    }
  }, [task?.id, task?.title, task?.notes, task?.category, task?.priority, task?.status, task?.due_at, task?.project_id, task?.delegated_to, task?.important, task?.recurrence, task?.tags, task?.energy_level])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!task || !state.title.trim()) return

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
      recurrence?: "daily" | "weekly" | "monthly" | null
      tags?: string[] | null
      energy_level?: "low" | "med" | "high" | null
    } = {
      id: task.id,
      title: state.title.trim(),
      notes: state.taskNotes.trim() || undefined,
      category: state.category,
      priority: state.priority,
      status: state.status,
      due_at: state.dueAt ? new Date(state.dueAt).toISOString() : undefined,
      project_id: state.projectId || null,
      delegated_to: state.delegatedTo.trim() || null,
      important: state.important,
      recurrence: (state.recurrence || null) as "daily" | "weekly" | "monthly" | null,
      tags: state.tagsInput.trim() ? state.tagsInput.trim().split(/\s+/).filter(Boolean) : null,
      energy_level: state.energyLevel || null,
    }

    if (state.status === "done" && task.status !== "done") {
      updates.completed_at = new Date().toISOString()
    } else if (state.status !== "done" && task.status === "done") {
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

  const inputClass = "w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:border-teal transition-colors"

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
              value={state.title}
              onChange={(e) => dispatch({ type: "field", key: "title", value: e.target.value })}
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
              value={state.taskNotes}
              onChange={(e) => dispatch({ type: "field", key: "taskNotes", value: e.target.value })}
              placeholder="Notas, links, contexto..."
              rows={3}
              className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-[13px] font-mono text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:border-teal transition-colors resize-none"
            />
          </div>

          {linkedNotes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
                Notas vinculadas
              </span>
              <div className="space-y-1">
                {linkedNotes.map((n) => (
                  <Link
                    key={n.id}
                    href="/notes"
                    className="block text-[11px] font-mono text-teal/70 hover:text-teal border border-border rounded-sm px-2 py-1 truncate no-underline"
                  >
                    {n.title}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              Data limite
            </span>
            <input
              type="datetime-local"
              value={state.dueAt}
              onChange={(e) => dispatch({ type: "field", key: "dueAt", value: e.target.value })}
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
                  onClick={() => dispatch({ type: "field", key: "category", value: opt.value })}
                  className={cn(
                    "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-wider border transition-colors",
                    state.category === opt.value
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
              value={state.projectId}
              onChange={(e) => dispatch({ type: "field", key: "projectId", value: e.target.value })}
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
              value={state.delegatedTo}
              onChange={(e) => dispatch({ type: "field", key: "delegatedTo", value: e.target.value })}
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
                checked={state.important}
                onChange={(e) => dispatch({ type: "field", key: "important", value: e.target.checked })}
                className="w-3.5 h-3.5 rounded-[3px] border border-on-surface/30 bg-bg checked:bg-amber checked:border-amber focus:outline-none cursor-pointer"
              />
              <span className="text-[11px] font-mono text-on-surface/50">
                Marcar como importante (Eisenhower)
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              Recorrência
            </span>
            <div className="flex gap-1.5">
              {[{ value: "", label: "NENHUMA" }, { value: "daily", label: "DIÁRIA" }, { value: "weekly", label: "SEMANAL" }, { value: "monthly", label: "MENSAL" }].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => dispatch({ type: "field", key: "recurrence", value: opt.value })}
                  className={cn(
                    "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-wider border transition-colors",
                    state.recurrence === opt.value
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
              Tags
            </span>
            <input
              value={state.tagsInput}
              onChange={(e) => dispatch({ type: "field", key: "tagsInput", value: e.target.value })}
              placeholder="#casa #trabalho — separar por espaços"
              className={inputClass}
            />
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
                  onClick={() => dispatch({ type: "field", key: "status", value: opt.value })}
                  className={cn(
                    "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-wider border transition-colors",
                    state.status === opt.value
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
                  onClick={() => dispatch({ type: "field", key: "priority", value: opt.value })}
                  className={cn(
                    "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-wider border transition-colors",
                    state.priority === opt.value
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
              Energia
            </span>
            <div className="flex gap-1.5 flex-wrap">
              {ENERGY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => dispatch({ type: "field", key: "energyLevel", value: state.energyLevel === opt.value ? "" : opt.value })}
                  className={cn(
                    "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-wider border transition-colors",
                    state.energyLevel === opt.value
                      ? "bg-purple-400/15 text-purple-400 border-purple-400/40"
                      : "text-on-surface/40 border-border hover:border-on-surface/30"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            {state.confirmDelete ? (
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
                  onClick={() => dispatch({ type: "field", key: "confirmDelete", value: false })}
                  className="h-7 px-3 text-[10px] font-mono text-on-surface/40 hover:text-on-surface/60 transition-colors"
                >
                  NÃO
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => dispatch({ type: "field", key: "confirmDelete", value: true })}
                className="h-7 px-3 text-[9px] font-mono text-on-surface/40 hover:text-danger transition-colors"
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
                disabled={!state.title.trim() || updateTask.isPending}
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