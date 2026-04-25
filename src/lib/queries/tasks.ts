import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Task } from "@/lib/schemas/task"
import type { Database } from "@/lib/database.types"

export type TaskRow = Database["public"]["Tables"]["task"]["Row"]

export const taskKeys = {
  all: ["tasks"] as const,
}


export function useTasks() {
  return useQuery({
    queryKey: taskKeys.all,
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
    mutationFn: async ({
      id,
      ...updates
    }: { id: string; completed_at?: string | null } & Partial<Omit<Task, "id">>) => {
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
    onMutate: async (vars: { id: string; completed_at?: string | null } & Partial<Omit<Task, "id">>) => {
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
