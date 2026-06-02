import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { generateRecurringEvents } from "@/lib/recurrence"
import type { AnnualEventRow, AnnualEventInsert, AnnualEventUpdate } from "@/lib/types"

export const annualEventKeys = {
  all: ["annual-event"] as const,
  year: (year: number) => ["annual-event", year] as const,
  tasks: (year: number) => ["annual-event-tasks", year] as const,
  appointments: (year: number) => ["annual-event-appointments", year] as const,
}

export function annualEventsOptions(year: number) {
  return queryOptions({
    queryKey: annualEventKeys.year(year),
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data, error } = await supabase
        .from("annual_event")
        .select("id, owner_id, title, start_date, end_date, start_time, end_time, color, recurrence, project_id, series_id, created_at, updated_at, project:project_id(name)")
        .eq("owner_id", user.id)
        .or(`start_date.lte.${year}-12-31,end_date.gte.${year}-01-01`)
        .order("start_date", { ascending: true })

      if (error) throw error
      const rows = (data ?? []).map((row: any) => ({
        ...row,
        project_name: row.project?.name || null,
      }))
      return rows as AnnualEventRow[]
    },
    staleTime: 30_000,
  })
}

export function useAnnualTasks(year: number) {
  return useQuery({
    queryKey: annualEventKeys.tasks(year),
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data, error } = await supabase
        .from("task")
        .select("id, title, due_at, priority, status, category")
        .eq("owner_id", user.id)
        .in("status", ["todo", "doing"])
        .not("due_at", "is", null)
        .gte("due_at", `${year}-01-01`)
        .lte("due_at", `${year}-12-31`)
        .order("due_at", { ascending: true })

      if (error) throw error
      return (data ?? []) as AnnualTaskRow[]
    },
    staleTime: 30_000,
  })
}

export function useAnnualAppointments(year: number) {
  return useQuery({
    queryKey: annualEventKeys.appointments(year),
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data, error } = await supabase
        .from("appointment")
        .select("id, title, starts_at, kind, location")
        .eq("owner_id", user.id)
        .gte("starts_at", `${year}-01-01T00:00:00`)
        .lt("starts_at", `${year + 1}-01-01T00:00:00`)
        .order("starts_at", { ascending: true })

      if (error) throw error
      return (data ?? []) as AnnualAppointmentRow[]
    },
    staleTime: 30_000,
  })
}

export function useCreateAnnualEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: AnnualEventInsert) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const events = generateRecurringEvents(input)
      const { data, error } = await supabase
        .from("annual_event")
        .insert(events.map((e) => ({ ...e, owner_id: user.id })))
        .select()

      if (error) throw error
      return data as AnnualEventRow[]
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: annualEventKeys.all })
    },
  })
}

export function useUpdateAnnualEventSeries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ seriesId, ...input }: AnnualEventUpdate & { seriesId: string }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data, error } = await supabase
        .from("annual_event")
        .update(input)
        .eq("series_id", seriesId)
        .eq("owner_id", user.id)
        .select()

      if (error) throw error
      return data as AnnualEventRow[]
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: annualEventKeys.all })
    },
  })
}

export function useDeleteAnnualEventSeries() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (seriesId: string) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("annual_event")
        .delete()
        .eq("series_id", seriesId)
        .eq("owner_id", user.id)

      if (error) throw error
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: annualEventKeys.all })
    },
  })
}

export function useUpdateAnnualEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...input }: AnnualEventUpdate & { id: string }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data, error } = await supabase
        .from("annual_event")
        .update(input)
        .eq("id", id)
        .eq("owner_id", user.id)
        .select()
        .single()

      if (error) throw error
      return data as AnnualEventRow
    },
    onSuccess(_data, _variables) {
      queryClient.invalidateQueries({ queryKey: annualEventKeys.all })
    },
  })
}

export function useDeleteAnnualEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { error } = await supabase
        .from("annual_event")
        .delete()
        .eq("id", id)
        .eq("owner_id", user.id)

      if (error) throw error
    },
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: annualEventKeys.all })
    },
  })
}

export interface AnnualTaskRow {
  id: string
  title: string
  due_at: string
  priority: string
  status: string
  category: string
}

export interface AnnualAppointmentRow {
  id: string
  title: string
  starts_at: string
  kind: string | null
  location: string | null
}

export function useAnnualTasks(year: number) {
  return useQuery({
    queryKey: annualEventKeys.tasks(year),
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data, error } = await supabase
        .from("task")
        .select("id, title, due_at, priority, status, category")
        .eq("owner_id", user.id)
        .in("status", ["todo", "doing"])
        .not("due_at", "is", null)
        .gte("due_at", `${year}-01-01`)
        .lte("due_at", `${year}-12-31`)
        .order("due_at", { ascending: true })

      if (error) throw error
      return (data ?? []) as AnnualTaskRow[]
    },
    staleTime: 30_000,
  })
}
