import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { Note } from "@/lib/schemas/note"
import type { NoteRow } from "@/lib/types"
import { useRealtimeTable } from "@/lib/realtime"
import { syncNoteEmbedding, deleteNoteEmbedding } from "@/lib/actions/semantic-search"

export type { NoteRow }

type NoteVars = {
  id?: string
  title?: string
  content?: string | null
  tags?: string[] | null
  pinned?: boolean
  linked_task_id?: string | null
  para?: "projects" | "areas" | "resources" | "archive" | null
  daily_date?: string | null
  is_moc?: boolean
  last_review?: string | null
  project_id?: string | null
}

export const noteKeys = {
  all: ["notes"] as const,
  pinned: ["notes", "pinned"] as const,
  byTask: (taskId: string) => ["notes", "task", taskId] as const,
  daily: (date: string) => ["notes", "daily", date] as const,
  mocs: ["notes", "mocs"] as const,
}

const notesOptions = queryOptions({
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

export function useNotes() {
  useRealtimeTable("note")
  return useQuery(notesOptions)
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
      // Sync embedding async — fire-and-forget, failure is non-blocking
      syncNoteEmbedding(data.id).catch(() => null)
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: NoteVars & { id: string }) => {
      const { id, ...updates } = vars
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
    onSettled: (_data, _err, vars) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
      // Sync embedding async — fire-and-forget
      syncNoteEmbedding(vars.id).catch(() => null)
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
    onSettled: (_data, _err, id) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
      // Delete embedding async
      deleteNoteEmbedding(id).catch(() => null)
    },
  })
}

export function useDailyNote(date: string) {
  useRealtimeTable("note")
  return useQuery({
    queryKey: noteKeys.daily(date),
    queryFn: async (): Promise<NoteRow | null> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("note")
        .select("*")
        .eq("owner_id", user.id)
        .eq("daily_date", date)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as NoteRow | null
    },
  })
}
