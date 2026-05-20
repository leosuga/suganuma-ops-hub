"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { useCreateProject } from "@/lib/queries/projects"

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
  const createProject = useCreateProject()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await createProject.mutateAsync({
      name: name.trim(),
      description: description.trim() || null,
      color,
      status: "active",
    })
    setName("")
    setDescription("")
    setColor("#55D7ED")
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => onOpenChange(v)}>
      <DialogContent className="bg-surface border-border max-w-md p-0 gap-0">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            NOVO PROJETO
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
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
              {createProject.isPending ? "CRIANDO..." : "CRIAR \u2192"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
