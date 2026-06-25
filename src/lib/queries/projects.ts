import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Project } from "@/lib/schemas/project"
import type { ProjectRow } from "@/lib/types"
import { useRealtimeTable } from "@/lib/realtime"

export type { ProjectRow }

type ProjectVars = {
  id?: string
  name?: string
  description?: string | null
  color?: string
  status?: string
}

export const projectKeys = {
  all: ["projects"] as const,
}

export const projectsOptions = queryOptions({
  queryKey: projectKeys.all,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<ProjectRow[]> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("project")
      .select("*")
      .order("created_at", { ascending: false })
    if (error) throw error
    return (data ?? []) as ProjectRow[]
  },
})

export function useProjects(opts?: { enabled?: boolean }) {
  useRealtimeTable("project")
  return useQuery({ ...projectsOptions, enabled: opts?.enabled ?? true })
}

export function useCreateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (project: Omit<Project, "id">) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("project")
        .insert({ ...project, owner_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as ProjectRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useUpdateProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: ProjectVars & { id: string }) => {
      const { id, ...updates } = vars
      const supabase = createClient()
      const { data, error } = await supabase
        .from("project")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as ProjectRow
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all })
      const prev = queryClient.getQueryData<ProjectRow[]>(projectKeys.all)
      queryClient.setQueryData<ProjectRow[]>(projectKeys.all, (old) =>
        (old ?? []).map((p) => (p.id === vars.id ? { ...p, ...vars } : p))
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(projectKeys.all, ctx.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useDeleteProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("project").delete().eq("id", id)
      if (error) throw error
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: projectKeys.all })
      const prev = queryClient.getQueryData<ProjectRow[]>(projectKeys.all)
      queryClient.setQueryData<ProjectRow[]>(projectKeys.all, (old) =>
        (old ?? []).filter((p) => p.id !== id)
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(projectKeys.all, ctx.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}
