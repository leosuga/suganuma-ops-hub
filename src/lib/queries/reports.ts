import { queryOptions, useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/lib/realtime"

export interface ReportsData {
  tasks: { id: string; completed_at: string | null; due_at: string | null; created_at: string }[]
  transactions: { id: string; kind: string; amount: number; occurred_on: string }[]
  habits: { id: string; name: string; active: boolean; emoji: string | null; color: string | null }[]
  entries: { habit_id: string; done_on: string }[]
}

export const reportsKeys = {
  all: ["reports"] as const,
  period: (period: number | "all") => ["reports", period] as const,
}

function getCutoff(period: number | "all"): string | null {
  if (period === "all") return null
  // Fetch a wider window than the selected period so trend charts have context.
  // e.g. period=7 → fetch 30 days; period=30 → fetch 90 days; period=90 → fetch 365 days.
  const days = period <= 7 ? 30 : period <= 30 ? 90 : 365
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

export function reportsOptions(period: number | "all" = 30) {
  return queryOptions({
    queryKey: reportsKeys.period(period),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ReportsData> => {
      const supabase = createClient()
      const cutoff = getCutoff(period)

      const [t, tr, h, e] = await Promise.all([
        supabase
          .from("task")
          .select("id, completed_at, due_at, created_at")
          .neq("status", "archived")
          .order("created_at", { ascending: false })
          .limit(500),
        cutoff
          ? supabase
              .from("transaction")
              .select("id, kind, amount, occurred_on")
              .gte("occurred_on", cutoff.slice(0, 10))
              .order("occurred_on", { ascending: false })
              .limit(1000)
          : supabase
              .from("transaction")
              .select("id, kind, amount, occurred_on")
              .order("occurred_on", { ascending: false })
              .limit(1000),
        supabase.from("habit_track").select("id, name, active, emoji, color").limit(200),
        cutoff
          ? supabase
              .from("habit_entry")
              .select("habit_id, done_on")
              .gte("done_on", cutoff.slice(0, 10))
              .limit(1000)
          : supabase.from("habit_entry").select("habit_id, done_on").limit(1000),
      ])

      if (t.error) throw t.error
      if (tr.error) throw tr.error
      if (h.error) throw h.error
      if (e.error) throw e.error

      return {
        tasks: (t.data ?? []) as ReportsData["tasks"],
        transactions: (tr.data ?? []) as ReportsData["transactions"],
        habits: (h.data ?? []) as ReportsData["habits"],
        entries: (e.data ?? []) as ReportsData["entries"],
      }
    },
  })
}

export function useReports(period: number | "all" = 30) {
  useRealtimeTable("task")
  useRealtimeTable("transaction")
  useRealtimeTable("habit_entry")
  return useQuery(reportsOptions(period))
}