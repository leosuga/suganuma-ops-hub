"use client"

import { useState, useCallback } from "react"
import dynamic from "next/dynamic"
import { useTitle } from "@/lib/useTitle"
import { useProjects, useUpdateProject, useDeleteProject, useCreateProject } from "@/lib/queries/projects"
import type { ProjectRow } from "@/lib/queries/projects"
import { useTasks } from "@/lib/queries/tasks"
import type { TaskRow } from "@/lib/queries/tasks"
import { useNotes, useDeleteNote, useCreateNote } from "@/lib/queries/notes"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { useUndoToast } from "@/components/UndoToast"
import { ProjectCard } from "@/components/projects/ProjectCard"

const CreateProjectDialog = dynamic(() => import("@/components/projects/CreateProjectDialog").then(m => ({ default: m.CreateProjectDialog })), { ssr: false })
const ProjectNotesDialog = dynamic(() => import("@/components/projects/ProjectNotesDialog").then(m => ({ default: m.ProjectNotesDialog })), { ssr: false })

function calcProgress(projectId: string, tasks: TaskRow[]) {
  const projectTasks = tasks.filter((t) => t.project_id === projectId)
  const total = projectTasks.length
  const done = projectTasks.filter((t) => t.status === "done").length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  return { total, done, pct }
}

function countProjectNotes(projectId: string, notes: { project_id: string | null }[]) {
  return notes.filter((n) => n.project_id === projectId).length
}

export default function ProjectsPage() {
  useTitle("Projects · Suganuma Ops Hub")
  const { data: projects = [], isLoading } = useProjects()
  const { data: tasks = [] } = useTasks()
  const { data: notes = [] } = useNotes()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()
  const createProject = useCreateProject()
  const deleteNote = useDeleteNote()
  const createNote = useCreateNote()
  const toast = useUndoToast()
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<ProjectRow | null>(null)
  const [notesDialogOpen, setNotesDialogOpen] = useState(false)

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

  function handleShowNotes(projectId: string) {
    const project = projects.find((p) => p.id === projectId) ?? null
    setSelectedProject(project)
    setNotesDialogOpen(true)
  }

  function handleDeleteNote(id: string) {
    const note = notes.find((n) => n.id === id)
    if (!note) return
    const snap = { ...note }
    deleteNote.mutate(id, {
      onSuccess: () => {
        toast.show({
          label: `"${snap.title.slice(0, 40)}" excluída`,
          onUndo: () => {
            createNote.mutate({
              title: snap.title,
              content: snap.content ?? null,
              tags: snap.tags ?? [],
              pinned: snap.pinned,
            })
          },
        })
      },
    })
  }

  async function handleCreateProjectNote(projectId: string, title: string, content: string | null) {
    await createNote.mutateAsync({
      title,
      content,
      tags: [],
      pinned: false,
      para: "projects",
      project_id: projectId,
    })
  }

  const getProgress = useCallback(
    (projectId: string) => calcProgress(projectId, tasks),
    [tasks]
  )

  const getNoteCount = useCallback(
    (projectId: string) => countProjectNotes(projectId, notes),
    [notes]
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
            <p className="text-[10px] font-mono text-on-surface/40 mt-0.5">
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
            <span className="text-[11px] font-mono text-on-surface/40">
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
                noteCount={getNoteCount(p.id)}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onShowNotes={handleShowNotes}
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
                  noteCount={getNoteCount(p.id)}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onShowNotes={handleShowNotes}
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
                  noteCount={getNoteCount(p.id)}
                  onStatusChange={handleStatusChange}
                  onDelete={handleDelete}
                  onShowNotes={handleShowNotes}
                />
              ))}
            </div>
          </div>
        )}

        <CreateProjectDialog open={createOpen} onOpenChange={setCreateOpen} />
        <ProjectNotesDialog
          open={notesDialogOpen}
          onOpenChange={setNotesDialogOpen}
          project={selectedProject}
          notes={notes}
          onDeleteNote={handleDeleteNote}
        />
      </div>
    </SectionErrorBoundary>
  )
}
