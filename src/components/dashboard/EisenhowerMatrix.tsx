"use client"

import Link from "next/link"
import type { TaskRow } from "@/lib/queries/tasks"
import type { ProjectRow } from "@/lib/queries/projects"

interface EisenhowerMatrixProps {
  pending: TaskRow[]
  projects: ProjectRow[]
}

export function EisenhowerMatrix({ pending, projects }: EisenhowerMatrixProps) {
  if (pending.length === 0) return null

  const q1 = pending.filter((t) => t.important && (t.priority === "urgent" || (t.due_at && new Date(t.due_at) < new Date())))
  const q2 = pending.filter((t) => t.important && t.priority !== "urgent" && (!t.due_at || new Date(t.due_at) >= new Date()))
  const q3 = pending.filter((t) => !t.important && (t.priority === "urgent" || (t.due_at && new Date(t.due_at) < new Date())))
  const q4 = pending.filter((t) => !t.important && t.priority !== "urgent" && (!t.due_at || new Date(t.due_at) >= new Date()))
  const quadrants = [
    { label: "URGENTE + IMPORTANTE", tasks: q1, color: "text-danger" },
    { label: "IMPORTANTE · NÃO URG", tasks: q2, color: "text-amber" },
    { label: "URGENTE · NÃO IMPORT", tasks: q3, color: "text-teal" },
    { label: "NEM URG · NEM IMPORT", tasks: q4, color: "text-on-surface/30" },
  ]

  return (
    <div className="border border-border bg-surface rounded-sm">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
          FOCO — MATRIZ DE EISENHOWER
        </span>
        <Link href="/tasks" className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors">
          VER TASKS →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-[1px] bg-border">
        {quadrants.map((q) => (
          <div key={q.label} className="bg-surface p-3">
            <div className={`text-[8px] font-mono font-semibold tracking-wider uppercase ${q.color} mb-2`}>
              {q.label}
            </div>
            {q.tasks.length === 0 ? (
              <span className="text-[10px] font-mono text-on-surface/20">Vazio</span>
            ) : (
              <div className="space-y-1">
                {q.tasks.slice(0, 3).map((task) => (
                  <div key={task.id} className="flex items-center gap-1.5">
                    {task.project_id && (() => {
                      const proj = projects.find((p) => p.id === task.project_id)
                      return proj ? (
                        <span className="w-1.5 h-1.5 rounded-full flex-none" style={{ backgroundColor: proj.color }} />
                      ) : null
                    })()}
                    <span className="text-[10px] font-mono text-on-surface/60 truncate">{task.title}</span>
                  </div>
                ))}
                {q.tasks.length > 3 && (
                  <span className="text-[9px] font-mono text-on-surface/20">+{q.tasks.length - 3} mais</span>
                )}
              </div>
            )}
            <div className="text-[9px] font-mono text-on-surface/20 mt-1.5">
              {q.tasks.length} task{q.tasks.length !== 1 ? "s" : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
