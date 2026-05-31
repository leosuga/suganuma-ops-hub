import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { generateRecurringEvents } from "@/lib/recurrence"
import type { AnnualEventRow, AnnualEventInsert, AnnualEventUpdate } from "@/lib/types"

export const annualEventKeys = {
  all: ["annual-event"] as const,
  year: (year: number) => ["annual-event", year] as const,
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
        .select("id, owner_id, title, start_date, end_date, color, created_at, updated_at")
        .eq("owner_id", user.id)
        .gte("end_date", `${year}-01-01`)
        .lte("start_date", `${year}-12-31`)
        .order("start_date", { ascending: true })

      if (error) throw error
      return (data ?? []) as AnnualEventRow[]
    },
    staleTime: 30_000,
  })
}

export function useAnnualEvents(year: number) {
  return useQuery(annualEventsOptions(year))
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
