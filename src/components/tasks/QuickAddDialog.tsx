"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useCreateTask } from "@/lib/queries/tasks"
import { projectKeys } from "@/lib/queries/projects"
import type { ProjectRow } from "@/lib/queries/projects"
import { cn } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import { parseTitle } from "@/lib/parse-title"

type Category = "finance" | "logistics" | "personal" | "health"
type Priority = "low" | "med" | "high" | "urgent"

interface QuickAddDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

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

export function QuickAddDialog({ open, onOpenChange }: QuickAddDialogProps) {
  const [input, setInput] = useState("")
  const [category, setCategory] = useState<Category>("personal")
  const [priority, setPriority] = useState<Priority>("med")
  const createTask = useCreateTask()
  const queryClient = useQueryClient()

  const projects = queryClient.getQueryData<ProjectRow[]>(projectKeys.all) ?? []
  const parsed = parseTitle(input, projects)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed.title.trim()) return

    await createTask.mutateAsync({
      title: parsed.title,
      category: parsed.category ?? category,
      priority: parsed.priority ?? priority,
      due_at: parsed.due_at ?? null,
      project_id: parsed.project_id ?? null,
      delegated_to: parsed.delegated_to ?? undefined,
      important: parsed.important ?? false,
      status: "todo",
    })

    setInput("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="bg-surface border-border max-w-lg p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            NOVA TASK
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Título da task... (>projeto #finance !urgent ^tomorrow @Fulano +importante)"
            autoFocus
            className="w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
          />

          {/* Category selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              Categoria
            </span>
            <div className="flex gap-1.5">
              {CATEGORY_OPTIONS.map((opt) => {
                const active = (parsed.category ?? category) === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={cn(
                      "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-wider border transition-colors",
                      active
                        ? "bg-teal/15 text-teal border-teal/40"
                        : "text-on-surface/40 border-border hover:border-on-surface/30"
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Priority selector */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              Prioridade
            </span>
            <div className="flex gap-1.5">
              {PRIORITY_OPTIONS.map((opt) => {
                const active = (parsed.priority ?? priority) === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={cn(
                      "h-6 px-2.5 rounded-sm font-mono text-[9px] font-semibold tracking-wider border transition-colors",
                      active
                        ? "bg-teal/15 text-teal border-teal/40"
                        : "text-on-surface/40 border-border hover:border-on-surface/30"
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-8 px-3 font-mono text-[10px] tracking-wider text-on-surface/40 hover:text-on-surface/60 transition-colors"
            >
              CANCELAR
            </button>
            <button
              type="submit"
              disabled={!parsed.title.trim() || createTask.isPending}
              className="h-8 px-4 bg-teal/10 border border-teal text-teal font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
            >
              {createTask.isPending ? "CRIANDO..." : "CRIAR TASK →"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
