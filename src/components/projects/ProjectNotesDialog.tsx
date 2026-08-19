"use client"

import { useState, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { NoteRow } from "@/lib/queries/notes"
import type { ProjectRow } from "@/lib/queries/projects"
import { NoteRow as NoteRowComponent } from "@/components/notes/NoteRow"
import { useTasks } from "@/lib/queries/tasks"
import { injectFrontmatter } from "@/lib/frontmatter"
import { buildBacklinksMap } from "@/lib/links"
import { cn } from "@/lib/utils"

interface ProjectNotesDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  project: ProjectRow | null
  notes: NoteRow[]
  onDeleteNote: (id: string) => void
  onCreateNote: (projectId: string, title: string, content: string | null) => Promise<void>
}

export function ProjectNotesDialog({ open, onOpenChange, project, notes, onDeleteNote, onCreateNote }: ProjectNotesDialogProps) {
  const [newTitle, setNewTitle] = useState("")
  const [creating, setCreating] = useState(false)
  const { data: tasks = [] } = useTasks()
  const backlinksMap = useMemo(() => buildBacklinksMap(notes), [notes])

  const projectNotes = useMemo(() => {
    if (!project) return []
    return notes.filter((n) => n.project_id === project.id).sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    })
  }, [project, notes])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!project || !newTitle.trim()) return
    setCreating(true)
    const tag = `proj/${project.name.toLowerCase().replace(/\s+/g, "-")}`
    const content = injectFrontmatter("", { status: "ativo", projeto: project.name })
    await onCreateNote(project.id, newTitle.trim(), content || null)
    setNewTitle("")
    setCreating(false)
  }

  if (!project) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-surface border-border max-w-lg p-0 gap-0 max-h-[85vh] overflow-auto">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <DialogTitle className="text-[10px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color }} />
              {project.name} — NOTAS
            </span>
          </DialogTitle>
        </DialogHeader>
        <div className="p-4 space-y-3">
          <form onSubmit={handleCreate} className="flex items-center gap-2">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Nova nota..."
              className="flex-1 h-8 px-3 bg-bg border border-border rounded-sm text-[11px] font-mono text-on-surface placeholder:text-on-surface/20 focus:border-teal/40 focus:outline-none"
            />
            <button
              type="submit"
              disabled={creating || !newTitle.trim()}
              className={cn(
                "h-8 px-3 font-mono text-[9px] font-semibold tracking-widest rounded-sm border transition-colors",
                creating || !newTitle.trim()
                  ? "text-on-surface/20 border-border bg-bg cursor-not-allowed"
                  : "text-teal border-teal/40 bg-teal/10 hover:bg-teal/20"
              )}
            >
              {creating ? "..." : "+ CRIAR"}
            </button>
          </form>

          {projectNotes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[11px] font-mono text-on-surface/30">Nenhuma nota vinculada a este projeto</p>
              <p className="text-[10px] font-mono text-on-surface/20 mt-1">
                Digite um título acima para criar a primeira nota
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {projectNotes.map((note) => (
                <NoteRowComponent
                  key={note.id}
                  note={note}
                  onDelete={onDeleteNote}
                  backlinksMap={backlinksMap}
                  tasks={tasks}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
