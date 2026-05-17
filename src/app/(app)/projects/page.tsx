"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { useTitle } from "@/lib/useTitle"
import { useProjects, useCreateProject, useUpdateProject, useDeleteProject } from "@/lib/queries/projects"
import type { ProjectRow } from "@/lib/queries/projects"
import { useTasks } from "@/lib/queries/tasks"
import { taskKeys } from "@/lib/queries/tasks"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { useUndoToast } from "@/components/UndoToast"
import { cn } from "@/lib/utils"
import { useQueryClient } from "@tanstack/react-query"
import type { TaskRow } from "@/lib/queries/tasks"

const PALETTE = [
  { value: "#55D7ED", label: "TEAL" },
  { value: "#60A5FA", label: "BLUE" },
  { value: "#4ADE80", label: "GREEN" },
  { value: "#C084FC", label: "PURPLE" },
  { value: "#FB923C", label: "ORANGE" },
]

function calcProgress(projectId: string, tasks: TaskRow[]) {
  const projectTasks = tasks.filter((t) => t.project_id === projectId)
  const total = projectTasks.length
  const done = projectTasks.filter((t) => t.status === "done").length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return { total, done, pct }
}

function CreateProjectDialog({
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
            placeholder="Descrição (opcional)"
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
              {createProject.isPending ? "CRIANDO..." : "CRIAR →"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ProjectCard({
  project,
  progress,
  onStatusChange,
  onDelete,
}: {
  project: ProjectRow
  progress: { total: number; done: number; pct: number }
  onStatusChange: (id: string, status: "active" | "done" | "paused") => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  const statusLabel =
    project.status === "active" ? "ATIVO" : project.status === "paused" ? "PAUSADO" : "CONCLUÍDO"
  const statusColor =
    project.status === "active"
      ? "text-teal border-teal/30"
      : project.status === "paused"
        ? "text-amber border-amber/30"
        : "text-on-surface/30 border-on-surface/20"

  return (
    <div className="border border-border bg-surface rounded-sm p-4 flex flex-col gap-3 hover:border-teal/30 transition-colors">
      <div className="flex items-start gap-2.5">
        <span
          className="w-3 h-3 rounded-full flex-none mt-0.5"
          style={{ backgroundColor: project.color }}
        />
        <div className="flex-1 min-w-0">
          <Link
            href={`/tasks?project=${project.id}`}
            className="text-[13px] font-mono font-semibold text-on-surface hover:text-teal transition-colors"
          >
            {project.name}
          </Link>
          {project.description && (
            <p className="text-[11px] font-mono text-on-surface/40 mt-0.5 line-clamp-2">
              {project.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-bg rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress.pct}%`, backgroundColor: project.color }}
          />
        </div>
        <span className="text-[10px] font-mono text-on-surface/40 w-14 text-right tabular-nums">
          {progress.pct}%
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono text-on-surface/30">
          {progress.done}/{progress.total} tasks
        </span>
        <span
          className={cn(
            "text-[8px] font-mono font-semibold tracking-widest px-1.5 py-0.5 border rounded-sm uppercase",
            statusColor
          )}
        >
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center gap-1 pt-1 border-t border-border">
        {project.status === "active" && (
          <>
            <button
              onClick={() => onStatusChange(project.id, "paused")}
              className="text-[8px] font-mono text-on-surface/30 hover:text-amber tracking-wider transition-colors"
            >
              PAUSAR
            </button>
            <button
              onClick={() => onStatusChange(project.id, "done")}
              className="text-[8px] font-mono text-on-surface/30 hover:text-teal tracking-wider transition-colors"
            >
              CONCLUIR
            </button>
          </>
        )}
        {project.status === "paused" && (
          <button
            onClick={() => onStatusChange(project.id, "active")}
            className="text-[8px] font-mono text-on-surface/30 hover:text-teal tracking-wider transition-colors"
          >
            REATIVAR
          </button>
        )}
        {project.status === "done" && (
          <button
            onClick={() => onStatusChange(project.id, "active")}
            className="text-[8px] font-mono text-on-surface/30 hover:text-teal tracking-wider transition-colors"
          >
            REABRIR
          </button>
        )}
        {confirmDelete ? (
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => {
                onDelete(project.id)
                setConfirmDelete(false)
              }}
              className="text-[8px] font-mono text-danger hover:opacity-70 tracking-wider"
            >
              SIM
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-on-surface/30 hover:text-on-surface/60 text-[12px]"
            >
              ×
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-[8px] font-mono text-on-surface/30 hover:text-danger tracking-wider transition-colors ml-auto"
          >
            DELETAR
          </button>
        )}
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  useTitle("Projects · Suganuma Ops Hub")
  const { data: projects = [], isLoading } = useProjects()
  const { data: tasks = [] } = useTasks()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const createProject = useCreateProject()
  const toast = useUndoToast()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)

  function handleStatusChange(id: string, status: "active" | "done" | "paused") {
    updateProject.mutate({ id, status })
  }

  function handleDelete(id: string) {
    const project = projects.find((p) => p.id === id)
    if (!project) return
    const snap = { ...project }
    const projectTasks = tasks.filter((t) => t.project_id === id)
    deleteProject.mutate(id, {
      onSuccess: () => {
        toast.show({
          label: `"${snap.name.slice(0, 40)}" excluído`,
          onUndo: () => {
            createProject.mutate({
              name: snap.name,
              description: snap.description ?? null,
              color: snap.color,
              status: snap.status,
            })
          },
        })
      },
    })
  }

  const getProgress = useCallback(
    (projectId: string) => calcProgress(projectId, tasks),
    [tasks]
  )

  const active = projects.filter((p) => p.status === "active")
  const paused = projects.filter((p) => p.status === "paused")
  const done = projects.filter((p) => p.status === "done")

  return (
    <SectionErrorBoundary label="PROJECTS">
      <div className="p-4 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
              PROJETOS
            </h1>
            <p className="text-[10px] font-mono text-on-surface/30 mt-0.5">
              {projects.length} projeto{projects.length !== 1 ? "s" : ""}
              {active.length > 0 && ` · ${active.length} ativo${active.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="h-7 px-3 bg-teal/10 border border-teal/40 text-teal font-mono text-[9px] font-semibold tracking-widest rounded-sm hover:bg-teal/20 transition-colors"
          >
            + NOVO
          </button>
        </div>

        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="border border-border bg-surface rounded-sm p-4 h-28 animate-pulse"
              />
            ))}
          </div>
        )}

        {!isLoading && projects.length === 0 && (
          <div className="border border-border bg-surface rounded-sm p-8 flex flex-col items-center justify-center gap-3">
            <span className="text-[11px] font-mono text-on-surface/20">
              Nenhum projeto ainda
            </span>
            <button
              onClick={() => setCreateOpen(true)}
              className="text-[10px] font-mono text-teal hover:text-teal-hi transition-colors"
            >
              + Criar primeiro projeto
            </button>
          </div>
        )}

        {active.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {active.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                progress={getProgress(p.id)}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {paused.length > 0 && (
          <div className="space-y-3">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              PAUSADOS
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paused.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  progress={getProgress(p.id)}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}

        {done.length > 0 && (
          <div className="space-y-3">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
              CONCLUÍDOS
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {done.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  progress={getProgress(p.id)}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </div>
        )}

        <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
      </div>
    </SectionErrorBoundary>
  )
}
