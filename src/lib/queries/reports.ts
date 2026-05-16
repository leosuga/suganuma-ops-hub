import { useQuery, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { TaskRow } from "@/lib/queries/tasks"
import type { TransactionRow } from "@/lib/queries/finance"
import type { HabitTrackRow, HabitEntryRow } from "@/lib/queries/habits"

export interface ReportData {
  tasks: TaskRow[]
  transactions: TransactionRow[]
  habits: HabitTrackRow[]
  entries: HabitEntryRow[]
}

export const reportsKeys = {
  all: ["reports"] as const,
}

export const reportsOptions = queryOptions({
  queryKey: reportsKeys.all,
  queryFn: async (): Promise<ReportData> => {
    const supabase = createClient()

    const [
      { data: tasks, error: e1 },
      { data: transactions, error: e2 },
      { data: habits, error: e3 },
      { data: entries, error: e4 },
    ] = await Promise.all([
      supabase.from("task").select("*").neq("status", "archived"),
      supabase.from("transaction").select("*"),
      supabase.from("habit_track").select("*"),
      supabase.from("habit_entry").select("*").order("done_on", { ascending: true }).limit(1000),
    ])

    if (e1) throw e1
    if (e2) throw e2
    if (e3) throw e3
    if (e4) throw e4

    return {
      tasks: (tasks ?? []) as TaskRow[],
      transactions: (transactions ?? []) as TransactionRow[],
      habits: (habits ?? []) as HabitTrackRow[],
      entries: (entries ?? []) as HabitEntryRow[],
    }
  },
})

export function useReports() {
  return useQuery(reportsOptions)
}
