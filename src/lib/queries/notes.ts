import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/lib/realtime"
import { syncNoteEmbedding, syncNoteEmbeddings, deleteNoteEmbedding, deleteNoteEmbeddings } from "@/lib/actions/semantic-search"
import type { NoteRow, NoteInsert } from "@/lib/types/note"

export type { NoteRow }

export const noteKeys = {
  all: ["notes"] as const,
  daily: (date: string) => ["notes", "daily", date] as const,
}

// Colunas de NoteRow, explicitamente — sem search_vector (tsvector da busca
// full-text, migration 0033). select("*") trazia esse campo em toda listagem,
// crescendo com o conteúdo de cada nota sem nunca ser lido pela UI.
const NOTE_COLUMNS =
  "id, owner_id, title, content, tags, pinned, linked_task_id, para, daily_date, is_moc, last_review, project_id, favorited, attachments, created_at, updated_at"

const notesOptions = queryOptions({
  queryKey: noteKeys.all,
  staleTime: 60_000,
  queryFn: async (): Promise<NoteRow[]> => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")
    // O PostgREST do VPS tem PGRST_DB_MAX_ROWS=1000 — query sem paginação
    // retorna no MÁXIMO 1000 rows silenciosamente (2168 notas = ~1170 perdidas).
    // Paginar em ranges até esvaziar, como no exportAllData.
    const PAGE = 1000
    const all: NoteRow[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("note")
        .select(NOTE_COLUMNS)
        .eq("owner_id", user.id)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .range(from, from + PAGE - 1)
      if (error) throw error
      const rows = (data ?? []) as NoteRow[]
      all.push(...rows)
      if (rows.length < PAGE) break
    }
    return all
  },
})

export function useNotes() {
  useRealtimeTable("note")
  return useQuery(notesOptions)
}

export function dailyNoteOptions(date: string) {
  return queryOptions({
    queryKey: noteKeys.daily(date),
    enabled: !!date,
    queryFn: async (): Promise<NoteRow | null> => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("note")
        .select(NOTE_COLUMNS)
        .eq("owner_id", user.id)
        .eq("daily_date", date)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as NoteRow | null
    },
  })
}

export function useDailyNote(date: string) {
  useRealtimeTable("note")
  return useQuery(dailyNoteOptions(date))
}

export function useCreateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (note: Omit<NoteInsert, "owner_id">) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("note")
        .insert({ ...note, owner_id: user.id })
        .select().single()
      if (error) throw error
      return data as NoteRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noteKeys.all }),
    onSettled: (data) => {
      if (data?.id) syncNoteEmbedding(data.id).catch(() => null)
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string } & Partial<NoteRow>) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("note")
        .update(updates)
        .eq("id", id)
        .select().single()
      if (error) throw error
      return data as NoteRow
    },
    onMutate: async ({ id, ...updates }) => {
      await queryClient.cancelQueries({ queryKey: noteKeys.all })
      const prev = queryClient.getQueryData<NoteRow[]>(noteKeys.all)
      queryClient.setQueryData<NoteRow[]>(noteKeys.all, (old) =>
        (old ?? []).map((n) => (n.id === id ? { ...n, ...updates } : n))
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(noteKeys.all, ctx.prev)
    },
    onSettled: (data) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
      if (data?.id) syncNoteEmbedding(data.id).catch(() => null)
    },
  })
}

/**
 * Atualização em LOTE: N updates no banco + UM sync de embedding para o lote
 * inteiro. Antes, o bulk da UI (contexto/PARA de 30 notas) disparava N syncs —
 * N embeddings no Ollama (CPU do VPS) e N PUTs no Qdrant.
 */
export function useBulkUpdateNotes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (updates: Array<{ id: string; changes: Partial<NoteRow> }>) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      for (const u of updates) {
        const { error } = await supabase
          .from("note")
          .update(u.changes)
          .eq("id", u.id)
          .eq("owner_id", user.id)
        if (error) throw error
      }
      return updates.map((u) => u.id)
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
      if (ids.length > 0) syncNoteEmbeddings(ids).catch(() => null)
    },
  })
}

/** Exclusão em LOTE: 1 delete + 1 remoção de embeddings. */
export function useBulkDeleteNotes() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { error } = await supabase
        .from("note")
        .delete()
        .in("id", ids)
        .eq("owner_id", user.id)
      if (error) throw error
      return ids
    },
    onSuccess: (ids) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.all })
      if (ids.length > 0) deleteNoteEmbeddings(ids).catch(() => null)
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
