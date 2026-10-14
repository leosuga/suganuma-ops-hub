import { useMemo } from "react"
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/lib/realtime"
import { fetchAllPages } from "@/lib/queries/fetch-all-pages"
import { normalizeCategory, knownCategories } from "@/lib/finance/category"
import { useTransactions } from "@/lib/queries/finance"
import { currentMonth } from "@/lib/date"
import type { BudgetRow, BudgetCategoryRow } from "@/lib/types"

export const budgetKeys = {
  all: ["budget"] as const,
  byMonth: (month: string) => ["budget", month] as const,
  categories: ["budget", "categories"] as const,
}

export function budgetOptions(month: string) {
  return queryOptions({
    queryKey: budgetKeys.byMonth(month),
    staleTime: Infinity,
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
  useRealtimeTable("budget")
  return useQuery(budgetOptions(month))
}

export function useUpdateBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ month, target }: { id?: string; month: string; target: number }) => {
      const supabase = createClient()
      const { data: existing, error: lookupError } = await supabase.from("budget").select("id").eq("month", month).maybeSingle()
      if (lookupError) throw lookupError
      if (existing) {
        const { data, error } = await supabase
          .from("budget")
          .update({ target, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
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

// ---------------------------------------------------------- por categoria

export const budgetCategoriesOptions = queryOptions({
  queryKey: budgetKeys.categories,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<BudgetCategoryRow[]> => {
    const supabase = createClient()
    return fetchAllPages<BudgetCategoryRow>((from, to) =>
      supabase.from("budget_category").select("*").order("category", { ascending: true }).range(from, to),
    )
  },
})

export function useBudgetCategories() {
  useRealtimeTable("budget_category")
  return useQuery(budgetCategoriesOptions)
}

export function useUpsertBudgetCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ category, monthly_target }: { category: string; monthly_target: number }) => {
      const label = category.trim()
      if (!label) throw new Error("Categoria vazia")
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("budget_category")
        .upsert(
          {
            owner_id: user.id,
            category: label,
            category_key: normalizeCategory(label),
            monthly_target,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "owner_id,category_key" },
        )
        .select()
        .single()
      if (error) throw error
      return data as BudgetCategoryRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: budgetKeys.categories }),
  })
}

export function useDeleteBudgetCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("budget_category").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: budgetKeys.categories }),
  })
}

/** Categorias já usadas (metas + gastos do mês) para sugerir nos formulários e evitar "bebe" x "Bebê". */
export function useCategorySuggestions(): string[] {
  const { data: budgets = [] } = useQuery(budgetCategoriesOptions)
  const { data: txns = [] } = useTransactions({ month: currentMonth() })
  return useMemo(() => knownCategories(txns, budgets), [txns, budgets])
}
