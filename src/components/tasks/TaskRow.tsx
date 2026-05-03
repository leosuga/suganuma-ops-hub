"use client"

import { useState, useRef, useCallback } from "react"
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
  health: "text-health",
}

interface TaskRowProps {
  task: TaskRowType
  onToggle: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function TaskRow({ task, onToggle, onEdit, onDelete }: TaskRowProps) {
  const isDone = task.status === "done"
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [swipeX, setSwipeX] = useState(0)
  const rowRef = useRef<HTMLDivElement>(null)
  const swipingRef = useRef(false)

  const dueText = task.due_at
    ? new Date(task.due_at).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      })
    : null

  const isOverdue =
    task.due_at && !isDone && new Date(task.due_at) < new Date()

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isDone) return
    setTouchStart(e.touches[0].clientX)
    setSwipeX(0)
  }, [isDone])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (touchStart === null || isDone) return
    const diff = e.touches[0].clientX - touchStart
    setSwipeX(Math.max(-120, Math.min(120, diff)))
    swipingRef.current = Math.abs(diff) > 10
  }, [touchStart, isDone])

  const handleTouchEnd = useCallback(() => {
    if (!swipingRef.current) {
      setTouchStart(null)
      setSwipeX(0)
      return
    }

    if (swipeX < -70 && onDelete) {
      onDelete()
    } else if (swipeX > 70) {
      onToggle()
    }

    setTouchStart(null)
    setSwipeX(0)
    swipingRef.current = false
  }, [swipeX, onDelete, onToggle])

  return (
    <div
      ref={rowRef}
      className={cn(
        "relative overflow-hidden",
        isDone && "opacity-40"
      )}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Swipe background actions */}
      {swipeX < -20 && onDelete && (
        <div className="absolute inset-y-0 right-0 w-20 bg-danger/10 border-l border-danger/30 flex items-center justify-center">
          <span className="text-[9px] font-mono font-semibold tracking-wider text-danger uppercase">DEL</span>
        </div>
      )}
      {swipeX > 20 && (
        <div className="absolute inset-y-0 left-0 w-20 bg-teal/10 border-r border-teal/30 flex items-center justify-center">
          <span className="text-[9px] font-mono font-semibold tracking-wider text-teal uppercase">
            {isDone ? "UNDO" : "DONE"}
          </span>
        </div>
      )}

      {/* Main row content */}
      <div
        className={cn(
          "flex items-center gap-3 h-10 px-4 border-b border-border transition-colors relative bg-surface",
          "hover:bg-surface-hover",
        )}
        style={{
          transform: `translateX(${swipeX}px)`,
          transition: swipeX !== 0 && touchStart === null ? "transform 0.2s ease" : "none",
        }}
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
            <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-bg">
              <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

        {onEdit && (
          <button
            onClick={(e) => { e.stopPropagation(); onEdit() }}
            className="flex-none w-5 h-5 flex items-center justify-center text-on-surface/20 hover:text-teal transition-colors rounded-sm text-[11px]"
            aria-label={`Editar task: ${task.title}`}
          >
            ✎
          </button>
        )}
      </div>
    </div>
  )
}
