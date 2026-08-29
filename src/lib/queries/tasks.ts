import { useCallback } from "react"
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Task } from "@/lib/schemas/task"
import type { TaskRow } from "@/lib/types"
import { useRealtimeTable } from "@/lib/realtime"

export type { TaskRow }

type TaskVars = {
  id?: string
  title?: string
  notes?: string | null
  category?: "finance" | "logistics" | "personal" | "health"
  status?: "todo" | "doing" | "done" | "archived"
  priority?: "low" | "med" | "high" | "urgent"
  due_at?: string | null
  completed_at?: string | null
  project_id?: string | null
  delegated_to?: string | null
  important?: boolean
  recurrence?: "daily" | "weekly" | "monthly" | null
  energy_level?: "low" | "med" | "high" | null
  tags?: string[] | null
  linked_note_id?: string | null
}

export const taskKeys = {
  all: ["tasks"] as const,
  byProject: (projectId: string) => ["tasks", "project", projectId] as const,
  byNote: (noteId: string) => ["tasks", "note", noteId] as const,
}

export const tasksOptions = queryOptions({
  queryKey: taskKeys.all,
  staleTime: 30_000,
  queryFn: async (): Promise<TaskRow[]> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("task")
      .select("*")
      .neq("status", "archived")
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
    if (error) throw error
    return (data ?? []) as TaskRow[]
  },
})

export function useTasks() {
  useRealtimeTable("task")
  return useQuery(tasksOptions)
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (task: Omit<Task, "id">) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("task")
        .insert({ ...task, owner_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as TaskRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: TaskVars & { id: string }) => {
      const { id, ...updates } = vars
      const supabase = createClient()
      const { data, error } = await supabase
        .from("task")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as TaskRow
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all })
      const prev = queryClient.getQueryData<TaskRow[]>(taskKeys.all)
      queryClient.setQueryData<TaskRow[]>(taskKeys.all, (old) =>
        (old ?? []).map((t) =>
          t.id === vars.id ? { ...t, ...vars } : t
        )
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) {
        queryClient.setQueryData(taskKeys.all, ctx.prev)
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

/**
 * Alterna done/todo e, se a task for recorrente e estiver sendo concluída,
 * cria a próxima ocorrência. Extraído de tasks/page.tsx para reusar o mesmo
 * comportamento no Cockpit sem duplicar a lógica de recorrência.
 */
export function useToggleTaskDone() {
  const updateTask = useUpdateTask()
  const createTask = useCreateTask()

  return useCallback(
    (task: TaskRow) => {
      const isDone = task.status === "done"
      updateTask.mutate({
        id: task.id,
        status: isDone ? "todo" : "done",
        completed_at: isDone ? null : new Date().toISOString(),
      })
      if (!isDone && task.recurrence) {
        const nextDue = new Date()
        nextDue.setHours(23, 59, 0, 0)
        if (task.recurrence === "daily") nextDue.setDate(nextDue.getDate() + 1)
        else if (task.recurrence === "weekly") nextDue.setDate(nextDue.getDate() + 7)
        else if (task.recurrence === "monthly") nextDue.setMonth(nextDue.getMonth() + 1)
        createTask.mutate({
          title: task.title,
          category: task.category,
          priority: task.priority,
          status: "todo",
          due_at: nextDue.toISOString(),
          recurrence: task.recurrence as "daily" | "weekly" | "monthly",
          project_id: task.project_id ?? undefined,
          delegated_to: task.delegated_to ?? undefined,
          important: task.important,
          tags: task.tags,
        })
      }
    },
    [updateTask, createTask]
  )
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("task").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: taskKeys.all })
    },
  })
}

export function useTasksByNote(noteId: string) {
  useRealtimeTable("task")
  return useQuery({
    queryKey: taskKeys.byNote(noteId),
    queryFn: async (): Promise<TaskRow[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("task")
        .select("*")
        .eq("linked_note_id", noteId)
        .neq("status", "archived")
        .order("created_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as TaskRow[]
    },
    staleTime: 30_000,
  })
}
