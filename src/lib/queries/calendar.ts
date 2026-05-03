import { useQuery } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"

export interface AppointmentCal {
  id: string; title: string; starts_at: string; kind: string | null; location: string | null
}
export interface TaskCal {
  id: string; title: string; due_at: string | null; priority: string; status: string; category: string
}
export interface MealPlanCal {
  id: string; date: string; meal_type: string; meal_id: string | null
  meal?: { id: string; name: string; kind: string; tags: string[] | null } | null
}

export const calendarKeys = {
  range: (from: string, to: string) => ["calendar", from, to] as const,
}

export function useCalendarData(from: string, to: string) {
  return useQuery({
    queryKey: calendarKeys.range(from, to),
    queryFn: async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const [appointments, tasks, mealPlans] = await Promise.all([
        supabase
          .from("appointment")
          .select("id, title, starts_at, kind, location")
          .eq("owner_id", user.id)
          .gte("starts_at", from)
          .lte("starts_at", to)
          .order("starts_at", { ascending: true }),
        supabase
          .from("task")
          .select("id, title, due_at, priority, status, category")
          .eq("owner_id", user.id)
          .in("status", ["todo", "doing"])
          .not("due_at", "is", null)
          .gte("due_at", from)
          .lte("due_at", to)
          .order("due_at", { ascending: true }),
        supabase
          .from("meal_plan")
          .select("id, date, meal_type, meal_id, meal:meal_id (id, name, kind, tags)")
          .eq("owner_id", user.id)
          .gte("date", from.slice(0, 10))
          .lte("date", to.slice(0, 10))
          .order("date", { ascending: true }),
      ])

      return {
        appointments: (appointments.data ?? []) as AppointmentCal[],
        tasks: (tasks.data ?? []) as TaskCal[],
        mealPlans: (mealPlans.data ?? []) as unknown as MealPlanCal[],
      }
    },
  })
}
