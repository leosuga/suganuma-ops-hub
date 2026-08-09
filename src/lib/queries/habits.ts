import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/lib/realtime"
import type { HabitTrack, HabitEntry } from "@/lib/schemas/habit"
import type { HabitTrackRow, HabitEntryRow } from "@/lib/types"

export type { HabitTrackRow, HabitEntryRow }

export const habitKeys = {
  all: ["habits"] as const,
  entries: (habitId?: string) =>
    habitId ? (["habits", "entries", habitId] as const) : (["habits", "entries"] as const),
}

const habitsOptions = queryOptions({
  queryKey: habitKeys.all,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<HabitTrackRow[]> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("habit_track")
      .select("*")
      .order("active", { ascending: false })
      .order("created_at", { ascending: true })
    if (error) throw error
    return (data ?? []) as HabitTrackRow[]
  },
})

export function useHabits() {
  useRealtimeTable("habit_track")
  return useQuery(habitsOptions)
}

export function useCreateHabit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (habit: Omit<HabitTrack, "id">) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("habit_track")
        .insert({ ...habit, owner_id: user.id })
        .select().single()
      if (error) throw error
      return data as HabitTrackRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitKeys.all }),
  })
}

export function useUpdateHabit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<Omit<HabitTrack, "id">>) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("habit_track")
        .update(updates)
        .eq("id", id)
        .select().single()
      if (error) throw error
      return data as HabitTrackRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: habitKeys.all }),
  })
}

export function useDeleteHabit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("habit_track").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: habitKeys.all })
      queryClient.invalidateQueries({ queryKey: habitKeys.entries() })
    },
  })
}

export function habitEntriesOptions(habitId?: string) {
  return queryOptions({
    queryKey: habitKeys.entries(habitId),
    enabled: !!habitId,
    queryFn: async (): Promise<HabitEntryRow[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("habit_entry")
        .select("*")
        .eq("habit_id", habitId!)
        .order("done_on", { ascending: false })
        .limit(90)
      if (error) throw error
      return (data ?? []) as HabitEntryRow[]
    },
  })
}

export function useHabitEntries(habitId?: string) {
  useRealtimeTable("habit_entry")
  return useQuery(habitEntriesOptions(habitId))
}

export function useAllHabitEntries(limit = 400) {
  useRealtimeTable("habit_entry")
  return useQuery({
    queryKey: ["habits", "entries", "all", limit] as const,
    queryFn: async (): Promise<HabitEntryRow[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("habit_entry")
        .select("habit_id, done_on")
        .order("done_on", { ascending: false })
        .limit(limit)
      if (error) throw error
      return (data ?? []) as HabitEntryRow[]
    },
  })
}

export function useLogHabitEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (entry: Omit<HabitEntry, "id">) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("habit_entry")
        .insert(entry)
        .select().single()
      if (error) throw error
      return data as HabitEntryRow
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: habitKeys.entries(vars.habit_id) })
    },
  })
}

export function useDeleteHabitEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, habit_id }: { id: string; habit_id: string }) => {
      const supabase = createClient()
      const { error } = await supabase.from("habit_entry").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: habitKeys.entries(vars.habit_id) })
    },
  })
}
