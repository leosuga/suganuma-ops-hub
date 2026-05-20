import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/lib/realtime"
import type { Meal, MealPlan } from "@/lib/schemas/meal"
import type { MealRow, MealPlanRow } from "@/lib/types"

export type { MealRow, MealPlanRow }

export const mealKeys = {
  all: ["meals"] as const,
  plans: (weekStart: string) => ["meals", "plans", weekStart] as const,
}

const mealsOptions = queryOptions({
  queryKey: mealKeys.all,
  queryFn: async (): Promise<MealRow[]> => {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("meal")
      .select("*")
      .order("updated_at", { ascending: false })
    if (error) throw error
    return (data ?? []) as MealRow[]
  },
})

export function useMeals() {
  useRealtimeTable("meal", mealKeys.all)
  return useQuery(mealsOptions)
}

export function useCreateMeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (meal: Omit<Meal, "id">) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")
      const { data, error } = await supabase
        .from("meal")
        .insert({ ...meal, owner_id: user.id })
        .select().single()
      if (error) throw error
      return data as MealRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mealKeys.all }),
  })
}

export function useDeleteMeal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("meal").delete().eq("id", id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: mealKeys.all }),
  })
}

export function mealPlansOptions(weekStart: string) {
  return queryOptions({
    queryKey: mealKeys.plans(weekStart),
    queryFn: async (): Promise<MealPlanRow[]> => {
      const supabase = createClient()
      const endDate = new Date(weekStart)
      endDate.setDate(endDate.getDate() + 7)
      const { data, error } = await supabase
        .from("meal_plan")
        .select("*")
        .gte("date", weekStart)
        .lt("date", endDate.toISOString().slice(0, 10))
        .order("date", { ascending: true })
      if (error) throw error
      return (data ?? []) as MealPlanRow[]
    },
  })
}

export function useMealPlans(weekStart: string) {
  useRealtimeTable("meal_plan", mealKeys.plans(weekStart))
  return useQuery(mealPlansOptions(weekStart))
}

export function useSetMealPlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (plan: Omit<MealPlan, "id">) => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const { data: existing } = await supabase
        .from("meal_plan")
        .select("id")
        .eq("owner_id", user.id)
        .eq("date", plan.date)
        .eq("meal_type", plan.meal_type)
        .maybeSingle()

      if (existing) {
        const { data, error } = await supabase
          .from("meal_plan")
          .update({ meal_id: plan.meal_id, notes: plan.notes })
          .eq("id", existing.id)
          .select().single()
        if (error) throw error
        return data as MealPlanRow
      }

      const { data, error } = await supabase
        .from("meal_plan")
        .insert({ ...plan, owner_id: user.id })
        .select().single()
      if (error) throw error
      return data as MealPlanRow
    },
    onSuccess: (_data, vars) => {
      const d = new Date(vars.date)
      d.setDate(d.getDate() - d.getDay())
      queryClient.invalidateQueries({ queryKey: mealKeys.plans(d.toISOString().slice(0, 10)) })
    },
  })
}
