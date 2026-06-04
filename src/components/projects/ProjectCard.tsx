"use client"

import { useState } from "react"
import Link from "next/link"
import type { ProjectRow } from "@/lib/queries/projects"
import { cn } from "@/lib/utils"

interface ProjectCardProps {
  project: ProjectRow
  progress: { total: number; done: number; pct: number }
  noteCount: number
  onStatusChange: (id: string, status: "active" | "done" | "paused") => void
  onDelete: (id: string) => void
  onShowNotes?: (projectId: string) => void
}

export function ProjectCard({ project, progress, noteCount, onStatusChange, onDelete, onShowNotes }: ProjectCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showNotesInline, setShowNotesInline] = useState(false)

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
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-on-surface/30">
            {progress.done}/{progress.total} tasks
          </span>
          {noteCount > 0 && (
            <button
              onClick={() => onShowNotes?.(project.id)}
              className="text-[10px] font-mono text-teal/60 hover:text-teal border border-teal/20 rounded-sm px-1.5 py-0.5 transition-colors"
            >
              {noteCount} {noteCount === 1 ? "nota" : "notas"}
            </button>
          )}
        </div>
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
