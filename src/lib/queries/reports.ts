import { queryOptions, useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export interface ReportsData {
  tasks: { id: string; completed_at: string | null; due_at: string | null; created_at: string }[]
  transactions: { id: string; kind: string; amount: number; occurred_on: string }[]
  habits: { id: string; name: string; active: boolean; emoji: string | null; color: string | null }[]
  entries: { habit_id: string; done_on: string }[]
}

export const reportsKeys = {
  all: ["reports"] as const,
}

export const reportsOptions = queryOptions({
  queryKey: reportsKeys.all,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<ReportsData> => {
    const supabase = createClient()
    const [t, tr, h, e] = await Promise.all([
      supabase.from("task").select("id, completed_at, due_at, created_at").neq("status", "archived"),
      supabase.from("transaction").select("id, kind, amount, occurred_on"),
      supabase.from("habit_track").select("id, name, active, emoji, color"),
      supabase.from("habit_entry").select("habit_id, done_on").limit(500),
    ])
    return {
      tasks: (t.data ?? []) as ReportsData["tasks"],
      transactions: (tr.data ?? []) as ReportsData["transactions"],
      habits: (h.data ?? []) as ReportsData["habits"],
      entries: (e.data ?? []) as ReportsData["entries"],
    }
  },
})

export function useReports() {
  return useQuery(reportsOptions)
}
