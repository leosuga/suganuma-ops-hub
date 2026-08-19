import { useCallback } from "react"
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/lib/realtime"
import { triageInboxItem, triageAllPending } from "@/lib/actions/inbox-triage"
import { useCreateTask } from "@/lib/queries/tasks"
import { useCreateNote } from "@/lib/queries/notes"
import type { InboxItemRow } from "@/lib/types"

export interface InboxAiPayload {
  suggested_type?: string
  suggested_priority?: string
  suggested_tags?: string[]
  suggested_category?: string | null
  suggested_project_name?: string | null
  action_items?: string[]
  summary?: string
  duplicates?: Array<{ id: string; title: string; score: number; type: string }>
}

export const inboxKeys = {
  all: ["inbox"] as const,
  unprocessed: ["inbox", "unprocessed"] as const,
  byStatus: (status: string) => ["inbox", status] as const,
}

export function inboxOptions(status: string = "unprocessed") {
  return queryOptions({
    queryKey: inboxKeys.byStatus(status),
    staleTime: 30_000,
    queryFn: async (): Promise<InboxItemRow[]> => {
      const supabase = createClient()
      let q = supabase
        .from("inbox_item")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200)

      if (status !== "all") {
        q = q.eq("status", status)
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as InboxItemRow[]
    },
  })
}

export function useInbox(status: string = "unprocessed") {
  useRealtimeTable("inbox_item")
  return useQuery(inboxOptions(status))
}

export function useCreateInboxItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { content: string; source?: string }) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("inbox_item")
        .insert({
          owner_id: user.id,
          content: input.content,
          source: input.source ?? "manual",
        })
        .select("*")
        .single()
      if (error) throw error
      return data as InboxItemRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.all, exact: false })
    },
  })
}

export function useTriageInboxItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("inbox_item")
        .update({ status: "triaged", triaged_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single()
      if (error) throw error
      return data as InboxItemRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.all, exact: false })
    },
  })
}

export function useArchiveInboxItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("inbox_item")
        .update({ status: "archived" })
        .eq("id", id)
        .select("*")
        .single()
      if (error) throw error
      return data as InboxItemRow
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.all, exact: false })
    },
  })
}

export function useDeleteInboxItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase
        .from("inbox_item")
        .delete()
        .eq("id", id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.all, exact: false })
    },
  })
}

/**
 * Converte um item do inbox em task e marca como triado.
 * Extraído de inbox/page.tsx para reusar no Cockpit sem duplicar a lógica.
 */
export function useConvertInboxToTask() {
  const createTask = useCreateTask()
  const triage = useTriageInboxItem()
  return useCallback(
    async (item: InboxItemRow) => {
      const ai = item.ai_payload as InboxAiPayload | null
      await createTask.mutateAsync({
        title: (ai?.action_items?.[0] ?? item.content).slice(0, 200),
        category: (ai?.suggested_category as "finance" | "logistics" | "personal" | "health") ?? "personal",
        priority: (ai?.suggested_priority as "low" | "med" | "high" | "urgent") ?? "med",
        status: "todo",
        tags: ai?.suggested_tags ?? null,
      })
      await triage.mutateAsync(item.id)
    },
    [createTask, triage]
  )
}

/**
 * Converte um item do inbox em nota e marca como triado.
 * Extraído de inbox/page.tsx para reusar no Cockpit sem duplicar a lógica.
 */
export function useConvertInboxToNote() {
  const createNote = useCreateNote()
  const triage = useTriageInboxItem()
  return useCallback(
    async (item: InboxItemRow) => {
      const ai = item.ai_payload as InboxAiPayload | null
      await createNote.mutateAsync({
        title: (ai?.summary ?? item.content).slice(0, 100),
        content: item.content,
        pinned: false,
        tags: ai?.suggested_tags ?? undefined,
      })
      await triage.mutateAsync(item.id)
    },
    [createNote, triage]
  )
}

export function useTriageWithAI() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (itemId: string) => {
      const result = await triageInboxItem(itemId)
      if (!result.ok) throw new Error(result.error ?? "Triagem falhou")
      return result.result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.all, exact: false })
    },
  })
}

export function useTriageAllPending() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const result = await triageAllPending()
      if (!result.ok) throw new Error("Triagem em lote falhou")
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: inboxKeys.all, exact: false })
    },
  })
}