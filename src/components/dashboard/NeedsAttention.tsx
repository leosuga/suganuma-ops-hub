"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { TaskRow } from "@/lib/queries/tasks"

interface NeedsAttentionProps {
  tasks: TaskRow[]
  urgentCount: number
}

export function NeedsAttention({ tasks, urgentCount }: NeedsAttentionProps) {
  if (tasks.length === 0) return null

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
          {urgentCount > 0 ? "PRECISA DE ATENÇÃO" : "PRÓXIMAS TASKS"}
        </span>
        <Link href="/tasks" className="text-[9px] font-mono text-on-surface/30 hover:text-on-surface/60 transition-colors">
          VER TASKS →
        </Link>
      </div>
      <div className="divide-y divide-border">
        {tasks.map((task) => {
          const isOverdue = task.due_at && task.status !== "done" && new Date(task.due_at) < new Date()
          const dueText = task.due_at
            ? new Date(task.due_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
            : null
          return (
            <div key={task.id} className="flex items-center gap-3 h-10 px-4">
              <span className={cn(
                "flex-1 text-[12px] font-mono truncate",
                task.priority === "urgent" ? "text-danger" : "text-on-surface"
              )}>
                {task.title}
              </span>
              {dueText && (
                <span className={cn(
                  "flex-none text-[10px] font-mono",
                  isOverdue ? "text-danger" : "text-on-surface/30"
                )}>
                  {dueText}
                </span>
              )}
              <span className={cn(
                "flex-none text-[9px] font-mono font-semibold tracking-wider uppercase",
                task.priority === "urgent" ? "text-danger" : "text-on-surface/40"
              )}>
                {task.priority === "urgent" ? "URG" : task.priority.toUpperCase()}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
