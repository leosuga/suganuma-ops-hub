"use client"

import { useState, useCallback, useEffect, useMemo, Suspense } from "react"
import dynamic from "next/dynamic"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useTitle } from "@/lib/useTitle"
import { useTasks, useDeleteTask, useCreateTask, useToggleTaskDone } from "@/lib/queries/tasks"
import { useCreateNote } from "@/lib/queries/notes"
import type { TaskRow as TaskRowType } from "@/lib/queries/tasks"
import { useProjects } from "@/lib/queries/projects"
import { CategoryChips } from "@/components/tasks/CategoryChips"
import { TaskRow } from "@/components/tasks/TaskRow"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { VirtualizedList } from "@/components/VirtualizedList"
import { useUndoToast } from "@/components/UndoToast"
import { cn } from "@/lib/utils"

const EditTaskDialog = dynamic(() => import("@/components/tasks/EditTaskDialog").then(m => ({ default: m.EditTaskDialog })), {
  loading: () => <div className="fixed inset-0 z-50 bg-black/50 animate-pulse" />,
})
const QuickAddDialog = dynamic(() => import("@/components/tasks/QuickAddDialog").then(m => ({ default: m.QuickAddDialog })), { ssr: false })

type Category = "finance" | "logistics" | "personal" | "health"

function TasksPageInner() {
  useTitle("Tasks · Suganuma Ops Hub")
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [showDone, setShowDone] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<TaskRowType | null>(null)

  // Filtros na URL: ?project= ?cat= ?tag= ?search= — sobrevivem a reload,
  // ficam linkáveis e voltam no botão "voltar" do navegador.
  const category = (searchParams.get("cat") as Category | null) ?? null
  const tagFilter = searchParams.get("tag") ?? ""
  const urlSearch = searchParams.get("search") ?? ""
  const [search, setSearch] = useState(urlSearch)

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") params.delete(k)
        else params.set(k, v)
      }
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [searchParams, router, pathname]
  )

  // Link externo (ex.: Cockpit) muda a URL → a busca local acompanha.
  useEffect(() => {
    setSearch(urlSearch)
  }, [urlSearch])

  // Digitação → URL (debounce), para o filtro não se perder ao recarregar.
  useEffect(() => {
    if (search === urlSearch) return
    const t = setTimeout(() => updateParams({ search: search || null }), 400)
    return () => clearTimeout(t)
  }, [search, urlSearch, updateParams])

  const { data: tasks = [], isLoading, isError } = useTasks()
  const { data: projects = [] } = useProjects()
  const toggleDone = useToggleTaskDone()
  const deleteTask = useDeleteTask()
  const createTask = useCreateTask()
  const toast = useUndoToast()
  const createNote = useCreateNote()

  const handleCreateNote = useCallback((task: TaskRowType) => {
    const ctxFromTags = task.tags?.filter((t) => t.startsWith("ctx/")) ?? []
    createNote.mutate({
      title: task.title,
      content: task.notes ?? `Nota vinculada à task: ${task.title}`,
      linked_task_id: task.id,
      tags: ctxFromTags.length > 0 ? ctxFromTags : undefined,
      pinned: false,
    })
  }, [createNote])

  const projectFilter = searchParams.get("project")
  const projectFilterName = projectFilter
    ? projects.find((p) => p.id === projectFilter)?.name ?? null
    : null

  const filtered = tasks.filter((t) => {
    if (!showDone && t.status === "done") return false
    if (category && t.category !== category) return false
    if (projectFilter && t.project_id !== projectFilter) return false
    if (tagFilter.trim()) {
      const tag = tagFilter.trim().toLowerCase()
      if (!t.tags?.some((tg) => tg.toLowerCase() === tag)) return false
    }
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

  // Tags existentes (ctx/ fica de fora — é o eixo de contexto, não de tag).
  const taskTags = useMemo(() => {
    const set = new Set<string>()
    for (const t of tasks) {
      for (const tag of t.tags ?? []) {
        if (!tag.startsWith("ctx/")) set.add(tag)
      }
    }
    return Array.from(set).sort().slice(0, 12)
  }, [tasks])

  const handleToggle = useCallback((id: string) => {
    const task = tasks.find((t) => t.id === id)
    if (task) toggleDone(task)
  }, [tasks, toggleDone])

  const handleDelete = useCallback((id: string) => {
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
              important: task.important,
              due_at: task.due_at ?? undefined,
            })
          },
        })
      },
    })
  }, [tasks, deleteTask, createTask, toast])

  const renderTaskRow = useCallback((index: number) => {
    const task = filtered[index]
    return (
      <TaskRow
        key={task.id}
        task={task}
        onToggle={handleToggle}
        onEdit={setEditingTask}
        onDelete={handleDelete}
        onCreateNote={handleCreateNote}
      />
    )
  }, [filtered, handleToggle, handleDelete, handleCreateNote])

  const useVirtual = filtered.length > 50

  return (
    <SectionErrorBoundary label="TASK ENGINE">
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-none">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-mono font-semibold tracking-[0.2em] text-on-surface/60 uppercase">
            TASK ENGINE
          </span>
          <span className="text-[10px] font-mono text-on-surface/60">
            {tasks.filter((t) => t.status !== "done").length} pendentes
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDone(!showDone)}
            className="text-[9px] font-mono tracking-wider text-on-surface/60 hover:text-on-surface/60 transition-colors"
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

      {/* Project filter chip */}
      {projectFilterName && (
        <div className="px-4 py-2 border-b border-border flex items-center gap-2">
          <span className="text-[9px] font-mono text-on-surface/60 uppercase tracking-wider">PROJETO:</span>
          <span className="text-[10px] font-mono font-semibold text-teal uppercase tracking-wider">
            {projectFilterName}
          </span>
          <button
            onClick={() => updateParams({ project: null })}
            className="text-[10px] font-mono text-on-surface/60 hover:text-danger transition-colors ml-auto"
          >
            × LIMPAR
          </button>
        </div>
      )}

      {/* Category filter */}
      <CategoryChips value={category} onChange={(v) => updateParams({ cat: v })} counts={counts} />

      {/* Tag filter — o filtro existia no estado mas não tinha UI */}
      {taskTags.length > 0 && (
        <div className="px-4 py-2 border-b border-border flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-mono text-on-surface/60 uppercase tracking-wider">TAG:</span>
          {taskTags.map((tag) => (
            <button
              key={tag}
              onClick={() => updateParams({ tag: tagFilter === tag ? null : tag })}
              className={cn(
                "h-6 px-2 rounded-sm border font-mono text-[9px] tracking-wider transition-colors",
                tagFilter === tag
                  ? "border-teal/60 bg-teal/10 text-teal"
                  : "border-border text-on-surface/60 hover:text-on-surface/60"
              )}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div className="px-4 py-2 border-b border-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar tasks..."
          className="w-full h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/60 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/50 transition-colors"
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
            <p role="alert" className="text-[11px] font-mono text-danger">
              Erro ao carregar tasks
            </p>
          </div>
        )}

        {!isLoading && !isError && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-[11px] font-mono text-on-surface/60">
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
                  onToggle={handleToggle}
                  onEdit={setEditingTask}
                  onDelete={handleDelete}
                  onCreateNote={handleCreateNote}
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

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="h-32 animate-pulse" />}>
      <TasksPageInner />
    </Suspense>
  )
}
