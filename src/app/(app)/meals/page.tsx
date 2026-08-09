"use client"

import { useState, useMemo } from "react"
import { useTitle } from "@/lib/useTitle"
import { useMeals, useMealPlans, useSetMealPlan } from "@/lib/queries/meals"
import type { MealRow } from "@/lib/queries/meals"
import { cn } from "@/lib/utils"
import { startOfWeek, addDays, dateStr } from "@/lib/date"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { AddMealForm } from "@/components/meals/AddMealForm"
import { MealRow as MealRowComponent } from "@/components/meals/MealRow"

const DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const MEAL_TYPES = [
  { key: "breakfast" as const, label: "CAFÉ" },
  { key: "lunch" as const, label: "ALMOÇO" },
  { key: "dinner" as const, label: "JANTA" },
  { key: "snack" as const, label: "LANCHE" },
]

function getWeekDates() {
  const monday = startOfWeek(new Date())
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    dates.push(addDays(monday, i))
  }
  return dates
}

export default function MealsPage() {
  useTitle("Meals · Suganuma Ops Hub")
  const { data: meals = [], isLoading: mealsLoading } = useMeals()
  const setMealPlan = useSetMealPlan()
  const [showNewMeal, setShowNewMeal] = useState(false)

  const weekDates = useMemo(() => getWeekDates(), [])
  const weekStart = useMemo(() => {
    const d = new Date(weekDates[0])
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1))
    return dateStr(d)
  }, [weekDates])

  const { data: plans = [], isLoading: plansLoading } = useMealPlans(weekStart)

  const planMap = useMemo(() => {
    const map = new Map<string, string>()
    for (const p of plans) {
      if (p.meal_id) map.set(`${p.date}|${p.meal_type}`, p.meal_id)
    }
    return map
  }, [plans])

  const mealsByName = useMemo(() => {
    const map = new Map<string, MealRow>()
    for (const m of meals) map.set(m.id, m)
    return map
  }, [meals])

  return (
    <SectionErrorBoundary label="MEALS">
      <div className="p-4 space-y-5">
        {(mealsLoading || plansLoading) && (
          <div className="border border-border bg-surface rounded-sm h-64 animate-pulse" />
        )}
        {!(mealsLoading || plansLoading) && (
        <div className="space-y-5">
        <div>
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
            MEAL PLANNING
          </h1>
          <p className="text-[10px] font-mono text-on-surface/30 mt-0.5">
            {meals.length} receita{meals.length !== 1 ? "s" : ""} · planejamento semanal
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewMeal(!showNewMeal)}
            className={cn(
              "h-7 px-3 text-[9px] font-mono font-semibold tracking-wider border rounded-sm transition-colors",
              showNewMeal
                ? "border-teal text-teal bg-teal/10"
                : "border-border text-on-surface/40 hover:border-on-surface/40 hover:text-on-surface/70"
            )}
          >
            {showNewMeal ? "FECHAR" : "+ NOVA RECEITA"}
          </button>
        </div>

        {showNewMeal && <AddMealForm onCreated={() => setShowNewMeal(false)} />}

        {/* Weekly grid */}
        <div className="border border-border bg-surface rounded-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border bg-bg">
                  <th className="h-8 px-2 text-left text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase w-16" />
                  {weekDates.map((d, i) => {
                    const isToday = d.toDateString() === new Date().toDateString()
                    return (
                      <th key={i} className={cn(
                        "h-8 px-1 text-center text-[9px] font-mono font-semibold tracking-widest uppercase",
                        isToday ? "text-teal" : "text-on-surface/30"
                      )}>
                        {DAY_LABELS[d.getDay()]}
                        <br />
                        <span className="text-[8px] opacity-60">{d.getDate()}/{d.getMonth() + 1}</span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MEAL_TYPES.map((type) => (
                  <tr key={type.key}>
                    <td className="h-10 px-2 text-[9px] font-mono font-semibold tracking-wider text-on-surface/40 uppercase border-r border-border">
                      {type.label}
                    </td>
                    {weekDates.map((d, j) => {
                      const dateKey = dateStr(d)
                      const planKey = `${dateKey}|${type.key}`
                      const mealId = planMap.get(planKey)
                      const meal = mealId ? mealsByName.get(mealId) : null
                      const isToday = d.toDateString() === new Date().toDateString()

                      return (
                        <td key={j} className={cn(
                          "h-10 px-1 align-middle",
                          isToday && "bg-teal/[0.03]"
                        )}>
                          <div className="flex items-center gap-1">
                            <select
                              className="flex-1 h-7 bg-transparent border border-border/50 rounded-sm px-1.5 text-[10px] font-mono text-on-surface focus:outline-none focus:border-teal transition-colors"
                              value={mealId ?? ""}
                              onChange={async (e) => {
                                if (showNewMeal) {
                                  setShowNewMeal(false)
                                  return
                                }
                                const id = e.target.value || null
                                await setMealPlan.mutateAsync({
                                  date: dateKey,
                                  meal_type: type.key,
                                  meal_id: id,
                                  notes: null,
                                })
                              }}
                            >
                              <option value="">—</option>
                              {meals.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                              ))}
                            </select>
                          </div>
                          {meal && (
                            <p className="text-[8px] font-mono text-on-surface/20 truncate mt-0.5">
                              {meal.name.length > 15 ? meal.name.slice(0, 15) + "..." : meal.name}
                            </p>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Meal library */}
        {meals.length > 0 && (
          <div className="border border-border bg-surface rounded-sm overflow-hidden">
            <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
              <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">
                RECEITAS
              </span>
            </div>
            <div className="divide-y divide-border">
              {meals.map((meal) => (
                <MealRowComponent key={meal.id} meal={meal} />
              ))}
            </div>
          </div>
        )}
      </div>
      )}
      </div>
    </SectionErrorBoundary>
  )
}
