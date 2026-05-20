"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useCreateProject } from "@/lib/queries/projects"
import { useCreateTask } from "@/lib/queries/tasks"
import { TEMPLATES, getTemplate, type ProjectTemplate } from "@/lib/templates"
import { useQueryClient } from "@tanstack/react-query"
import { taskKeys } from "@/lib/queries/tasks"

const PALETTE = [
  { value: "#55D7ED", label: "TEAL" },
  { value: "#60A5FA", label: "BLUE" },
  { value: "#4ADE80", label: "GREEN" },
  { value: "#C084FC", label: "PURPLE" },
  { value: "#FB923C", label: "ORANGE" },
]

export function CreateProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [color, setColor] = useState("#55D7ED")
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const createProject = useCreateProject()
  const createTask = useCreateTask()
  const queryClient = useQueryClient()

  function selectTemplate(id: string) {
    const tpl = getTemplate(id)
    if (!tpl) return
    setSelectedTemplate(id)
    setName(tpl.name)
    setDescription(tpl.description)
    setColor(tpl.color)
  }

  function clearTemplate() {
    setSelectedTemplate("")
    setName("")
    setDescription("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    const result = await createProject.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      color,
      status: "active",
    })

    const tpl = selectedTemplate ? getTemplate(selectedTemplate) : null
    if (tpl && tpl.tasks.length > 0) {
      const supabase = (await import("@/lib/supabase/client")).createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await Promise.all(
          tpl.tasks.map((tt) =>
            createTask.mutateAsync({
              title: tt.title,
              category: tt.category ?? "personal",
              priority: tt.priority ?? "med",
              status: "todo",
              project_id: result.id,
            })
          )
        )
        queryClient.invalidateQueries({ queryKey: taskKeys.all })
      }
    }

    setName("")
    setDescription("")
    setColor("#55D7ED")
    setSelectedTemplate("")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="bg-surface border-border max-w-md p-0 gap-0 max-h-[90vh] overflow-auto">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            NOVO PROJETO
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          {selectedTemplate ? (
            <div className="border border-teal/30 bg-teal/5 rounded-sm p-3 flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full flex-none"
                style={{ backgroundColor: color }}
              />
              <span className="flex-1 text-[11px] font-mono text-teal">{name}</span>
              <button
                type="button"
                onClick={clearTemplate}
                className="text-[9px] font-mono text-on-surface/40 hover:text-danger transition-colors"
              >
                REMOVER
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
                  Templates
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => selectTemplate(tpl.id)}
                      className="flex items-center gap-2 p-2 rounded-sm border border-border hover:border-teal/40 hover:bg-surface-hover transition-colors text-left"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full flex-none"
                        style={{ backgroundColor: tpl.color }}
                      />
                      <div className="min-w-0">
                        <span className="text-[10px] font-mono font-semibold text-on-surface/70 block truncate">
                          {tpl.name}
                        </span>
                        <span className="text-[8px] font-mono text-on-surface/30 block truncate">
                          {tpl.tasks.length} tasks
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <span className="text-[9px] font-mono text-on-surface/20 uppercase tracking-wider block mb-2">
                  Ou criar manualmente
                </span>
                <div className="flex flex-col gap-4">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do projeto"
                    autoFocus
                    className="w-full h-9 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descri\u00e7\u00e3o (opcional)"
                    rows={2}
                    className="w-full bg-bg border border-border rounded-sm px-3 py-2 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors resize-none"
                  />
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
                      Cor
                    </span>
                    <div className="flex gap-2">
                      {PALETTE.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setColor(c.value)}
                          title={c.label}
                          className={cn(
                            "w-7 h-7 rounded-full border-2 transition-colors",
                            color === c.value
                              ? "border-on-surface"
                              : "border-transparent hover:border-on-surface/30"
                          )}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

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
              disabled={!name.trim() || createProject.isPending}
              className="h-8 px-4 bg-teal/10 border border-teal text-teal font-mono text-[10px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors"
            >
              {createProject.isPending ? "CRIANDO..." : selectedTemplate ? `CRIAR + ${getTemplate(selectedTemplate)!.tasks.length} TASKS` : "CRIAR \u2192"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
