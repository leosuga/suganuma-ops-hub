import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/lib/schemas/note"
import type { Database } from "@/lib/database.types"
import { useRealtimeTable } from "@/lib/realtime"

export type NoteRow = Database["public"]["Tables"]["note"]["Row"]

export const noteKeys = {
  all: ["notes"] as const,
  pinned: ["notes", "pinned"] as const,
}

export function useNotes() {
  useRealtimeTable("note", noteKeys.all)
  return useQuery({
    queryKey: noteKeys.all,
    queryFn: async (): Promise<NoteRow[]> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("note")
        .select("*")
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
      if (error) throw error
      return (data ?? []) as NoteRow[]
    },
  })
}

export function useCreateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (note: Omit<Note, "id">) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("note")
        .insert({ ...note, owner_id: user.id })
        .select()
        .single()
      if (error) throw error
      return data as NoteRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<Omit<Note, "id">>) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("note")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as NoteRow
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: noteKeys.all })
      const prev = queryClient.getQueryData<NoteRow[]>(noteKeys.all)
      queryClient.setQueryData<NoteRow[]>(noteKeys.all, (old) =>
        (old ?? []).map((n) =>
          n.id === vars.id ? { ...n, ...vars } : n
        )
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(noteKeys.all, ctx.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("note").delete().eq("id", id)
      if (error) throw error
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: noteKeys.all })
      const prev = queryClient.getQueryData<NoteRow[]>(noteKeys.all)
      queryClient.setQueryData<NoteRow[]>(noteKeys.all, (old) =>
        (old ?? []).filter((n) => n.id !== id)
      )
      return { prev }
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(noteKeys.all, ctx.prev)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
    },
  })
}
