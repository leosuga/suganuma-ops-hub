import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/lib/realtime"
import { fetchAllPages } from "@/lib/queries/fetch-all-pages"
import type { ChildRow, BabyLogRow } from "@/lib/types"
import type { Child, BabyLog } from "@/lib/schemas/baby"

export type { ChildRow, BabyLogRow }

export const babyKeys = {
  all: ["baby"] as const,
  child: ["baby", "child"] as const,
  logs: (childId?: string, days?: number) => ["baby", "logs", childId ?? null, days ?? null] as const,
  growth: (childId?: string) => ["baby", "growth", childId ?? null] as const,
}

async function currentUserId(): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

// ------------------------------------------------------------------- child

export const childOptions = queryOptions({
  queryKey: babyKeys.child,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<ChildRow | null> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("child")
      .select("*")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data as ChildRow | null
  },
})

export function useChild() {
  useRealtimeTable("child")
  return useQuery(childOptions)
}

export function useUpsertChild() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (child: Child) => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      const { id, ...fields } = child
      const row = { ...fields, owner_id: ownerId, updated_at: new Date().toISOString() }
      const q = id
        ? supabase.from("child").update(row).eq("id", id)
        : supabase.from("child").insert(row)
      const { data, error } = await q.select().single()
      if (error) throw error
      return data as ChildRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: babyKeys.child }),
  })
}

// ---------------------------------------------------------------- baby_log

/** Registros dos últimos `days` dias (paginado em ranges de 1000). */
export function babyLogsOptions(childId: string | undefined, days = 3) {
  return queryOptions({
    queryKey: babyKeys.logs(childId, days),
    enabled: !!childId,
    staleTime: 60_000,
    queryFn: async (): Promise<BabyLogRow[]> => {
      const supabase = createClient()
      const since = new Date(Date.now() - days * 86_400_000).toISOString()
      return fetchAllPages<BabyLogRow>((from, to) =>
        supabase
          .from("baby_log")
          .select("*")
          .eq("child_id", childId!)
          .gte("started_at", since)
          .order("started_at", { ascending: false })
          .range(from, to),
      )
    },
  })
}

export function useBabyLogs(childId: string | undefined, days = 3) {
  useRealtimeTable("baby_log")
  return useQuery(babyLogsOptions(childId, days))
}

/** Todas as medições (peso/comprimento/PC) — poucas linhas, sem janela de tempo. */
export function babyGrowthOptions(childId: string | undefined) {
  return queryOptions({
    queryKey: babyKeys.growth(childId),
    enabled: !!childId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<BabyLogRow[]> => {
      const supabase = createClient()
      return fetchAllPages<BabyLogRow>((from, to) =>
        supabase
          .from("baby_log")
          .select("*")
          .eq("child_id", childId!)
          .eq("kind", "growth")
          .order("started_at", { ascending: false })
          .range(from, to),
      )
    },
  })
}

export function useBabyGrowth(childId: string | undefined) {
  useRealtimeTable("baby_log")
  return useQuery(babyGrowthOptions(childId))
}

export function useCreateBabyLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (log: BabyLog) => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      const { data, error } = await supabase
        .from("baby_log")
        .insert({ ...log, owner_id: ownerId })
        .select()
        .single()
      if (error) throw error
      return data as BabyLogRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: babyKeys.all }),
  })
}

export function useUpdateBabyLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: { id: string } & Partial<Pick<BabyLogRow, "started_at" | "ended_at" | "data" | "notes">>) => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("baby_log")
        .update(updates)
        .eq("id", id)
        .select()
        .single()
      if (error) throw error
      return data as BabyLogRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: babyKeys.all }),
  })
}

export function useDeleteBabyLog() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("baby_log").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: babyKeys.all }),
  })
}
