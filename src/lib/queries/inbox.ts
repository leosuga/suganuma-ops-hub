import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/lib/realtime"
import { triageInboxItem } from "@/lib/actions/inbox-triage"
import type { InboxItemRow } from "@/lib/types"

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