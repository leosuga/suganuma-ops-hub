import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import type { BudgetRow } from "@/lib/types"

export const budgetKeys = {
  all: ["budget"] as const,
  byMonth: (month: string) => ["budget", month] as const,
}

export function budgetOptions(month: string) {
  return queryOptions({
    queryKey: budgetKeys.byMonth(month),
    queryFn: async (): Promise<BudgetRow | null> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("budget")
        .select("*")
        .eq("month", month)
        .maybeSingle()
      if (error) throw error
      return data as BudgetRow | null
    },
  })
}

export function useBudget(month: string) {
  return useQuery(budgetOptions(month))
}

export function useUpdateBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ month, target }: { id?: string; month: string; target: number }) => {
      const supabase = createClient()
      const { data: existing } = await supabase.from("budget").select("id").eq("month", month).maybeSingle()
      if (existing) {
        const { data, error } = await supabase
          .from("budget")
          .update({ target, updated_at: new Date().toISOString() })
          .eq("id", (existing as any).id)
          .select()
          .single()
        if (error) throw error
        return data as BudgetRow
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("budget")
        .insert({ owner_id: user.id, month, target })
        .select()
        .single()
      if (error) throw error
      return data as BudgetRow
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: budgetKeys.byMonth(vars.month) })
    },
  })
}
