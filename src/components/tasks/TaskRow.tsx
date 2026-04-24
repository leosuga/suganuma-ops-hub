"use client"

import { cn } from "@/lib/utils"
import type { TaskRow as TaskRowType } from "@/lib/queries/tasks"

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-danger border-danger/40 bg-danger/10",
  high: "text-amber border-amber/40 bg-amber/10",
  med: "text-on-surface/40 border-border bg-transparent",
  low: "text-on-surface/20 border-border/50 bg-transparent",
}

const CATEGORY_COLORS: Record<string, string> = {
  finance: "text-teal",
  logistics: "text-amber",
  personal: "text-on-surface/50",
  health: "text-[#A8D8B0]",
}

interface TaskRowProps {
  task: TaskRowType
  onToggle: () => void
}

export function TaskRow({ task, onToggle }: TaskRowProps) {
  const isDone = task.status === "done"

  const dueText = task.due_at
    ? new Date(task.due_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : null

  const isOverdue =
    task.due_at && !isDone && new Date(task.due_at) < new Date()

  return (
    <div
      className={cn(
        "flex items-center gap-3 h-10 px-4 border-b border-border transition-colors",
        "hover:bg-surface-hover",
        isDone && "opacity-40"
      )}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        aria-label={isDone ? "Marcar como pendente" : "Marcar como concluída"}
        className={cn(
          "flex-none w-3.5 h-3.5 rounded-[3px] border transition-colors",
          isDone
            ? "bg-teal border-teal flex items-center justify-center"
            : "border-on-surface/30 hover:border-teal"
        )}
      >
        {isDone && (
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            className="text-bg"
          >
            <path
              d="M1 4L3 6L7 2"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* Title */}
      <span
        className={cn(
          "flex-1 text-[12px] font-mono truncate",
          isDone ? "line-through text-on-surface/40" : "text-on-surface"
        )}
      >
        {task.title}
      </span>

      {/* Category dot */}
      <span
        className={cn(
          "flex-none text-[9px] font-mono font-semibold tracking-wider uppercase",
          CATEGORY_COLORS[task.category] ?? "text-on-surface/30"
        )}
      >
        {task.category.slice(0, 3)}
      </span>

      {/* Due date */}
      {dueText && (
        <span
          className={cn(
            "flex-none text-[10px] font-mono",
            isOverdue ? "text-danger" : "text-on-surface/30"
          )}
        >
          {dueText}
        </span>
      )}

      {/* Priority badge */}
      <span
        className={cn(
          "flex-none px-1.5 h-4 flex items-center rounded-[2px] border text-[8px] font-mono font-semibold tracking-wider uppercase",
          PRIORITY_COLORS[task.priority] ?? "text-on-surface/30 border-border"
        )}
      >
        {task.priority === "urgent" ? "URG" : task.priority.toUpperCase()}
      </span>
    </div>
  )
}
