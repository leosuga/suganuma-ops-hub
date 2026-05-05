"use client"

import { useState, useCallback } from "react"
import { useTasks, useUpdateTask, useDeleteTask, useCreateTask } from "@/lib/queries/tasks"
import type { TaskRow as TaskRowType } from "@/lib/queries/tasks"
import { CategoryChips } from "@/components/tasks/CategoryChips"
import { TaskRow } from "@/components/tasks/TaskRow"
import { QuickAddDialog } from "@/components/tasks/QuickAddDialog"
import { EditTaskDialog } from "@/components/tasks/EditTaskDialog"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { VirtualizedList } from "@/components/VirtualizedList"
import { useUndoToast } from "@/components/UndoToast"

type Category = "finance" | "logistics" | "personal" | "health"

export default function TasksPage() {
  const [category, setCategory] = useState<Category | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskRowType | null>(null)
  const [search, setSearch] = useState("")

  const { data: tasks = [], isLoading, isError } = useTasks()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const createTask = useCreateTask()
  const toast = useUndoToast()

  const filtered = tasks.filter((t) => {
    if (!showDone && t.status === "done") return false
    if (category && t.category !== category) return false
    if (search.trim()) {
      const q = search.toLowerCase().trim()
      const titleMatch = t.title.toLowerCase().includes(q)
      const notesMatch = t.notes?.toLowerCase().includes(q)
      if (!titleMatch && !notesMatch) return false
    }
    return true
  })

  const counts = tasks.reduce(
    (acc, t) => {
      if (t.status !== "done") {
        acc[t.category as Category] = (acc[t.category as Category] ?? 0) + 1
      }
      return acc
    },
    {} as Partial<Record<Category, number>>
  )

  function handleToggle(id: string, currentStatus: string) {
    const isDone = currentStatus === "done"
    updateTask.mutate({
      id,
      status: isDone ? "todo" : "done",
      completed_at: isDone ? null : new Date().toISOString(),
    })
  }

  function handleDelete(id: string) {
    const task = tasks.find((t) => t.id === id)
    if (!task) return
    deleteTask.mutate(id, {
      onSuccess: () => {
        toast.show({
          label: `"${task.title.slice(0, 40)}" excluída`,
          onUndo: () => {
            createTask.mutate({
              title: task.title,
              notes: task.notes ?? undefined,
              category: task.category,
              priority: task.priority,
              status: task.status,
              due_at: task.due_at ?? undefined,
            })
          },
        })
      },
    })
  }

  const renderTaskRow = useCallback((index: number) => {
    const task = filtered[index]
    return (
      <TaskRow
        task={task}
        onToggle={() => handleToggle(task.id, task.status)}
        onEdit={() => setEditingTask(task)}
        onDelete={() => handleDelete(task.id)}
      />
    )
  }, [filtered, handleToggle])

  const useVirtual = filtered.length > 50

  return (
    <SectionErrorBoundary label="TASK ENGINE">
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-none">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-semibold tracking-[0.2em] text-on-surface/40 uppercase">
            TASK ENGINE
          </span>
          <span className="text-[10px] font-mono text-on-surface/20">
            {tasks.filter((t) => t.status !== "done").length} pendentes
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDone(!showDone)}
            className="text-[9px] font-mono tracking-wider text-on-surface/30 hover:text-on-surface/50 transition-colors"
          >
            {showDone ? "OCULTAR DONE" : "VER DONE"}
          </button>
          <button
            onClick={() => setAddOpen(true)}
            className="h-7 px-3 bg-teal/10 border border-teal/40 text-teal font-mono text-[9px] font-semibold tracking-widest rounded-sm hover:bg-teal/20 transition-colors"
          >
            + NOVA
          </button>
        </div>
      </div>

      {/* Category filter */}
      <CategoryChips value={category} onChange={setCategory} counts={counts} />

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tasks..."
          className="w-full h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
        />
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-hidden">
        {isLoading && (
          <div className="flex items-center justify-center h-32">
            <div className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
          </div>
        )}

        {isError && (
          <div className="px-4 py-6 text-center">
            <p className="text-[11px] font-mono text-danger">
              Erro ao carregar tasks
            </p>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-[11px] font-mono text-on-surface/30">
              Nenhuma task encontrada
            </p>
            <button
              onClick={() => setAddOpen(true)}
              className="text-[10px] font-mono text-teal hover:text-teal-hi transition-colors"
            >
              + Criar primeira task
            </button>
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          useVirtual ? (
            <VirtualizedList
              items={filtered}
              rowHeight={40}
              renderRow={renderTaskRow}
            />
          ) : (
            <div className="overflow-auto h-full">
              {filtered.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onToggle={() => handleToggle(task.id, task.status)}
                  onEdit={() => setEditingTask(task)}
                  onDelete={() => handleDelete(task.id)}
                />
              ))}
            </div>
          )
        )}
      </div>

      <QuickAddDialog open={addOpen} onOpenChange={setAddOpen} />
      <EditTaskDialog
        open={!!editingTask}
        onOpenChange={(v) => { if (!v) setEditingTask(null) }}
        task={editingTask}
      />
    </div>
    </SectionErrorBoundary>
  )
}
