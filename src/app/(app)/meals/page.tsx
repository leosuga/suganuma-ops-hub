"use client"

import { useState, useMemo } from "react"
import { useMeals, useCreateMeal, useDeleteMeal, useMealPlans, useSetMealPlan } from "@/lib/queries/meals"
import type { MealRow } from "@/lib/queries/meals"
import { cn } from "@/lib/utils"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { useUndoToast } from "@/components/UndoToast"

const DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]
const MEAL_TYPES = [
  { key: "breakfast" as const, label: "CAFÉ" },
  { key: "lunch" as const, label: "ALMOÇO" },
  { key: "dinner" as const, label: "JANTA" },
  { key: "snack" as const, label: "LANCHE" },
]

function getWeekDates() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day
  const monday = new Date(now)
  monday.setDate(diff + 1)
  const dates: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    dates.push(d)
  }
  return dates
}

function MealSelector({ meals, onSelect }: { meals: MealRow[]; onSelect: (meal: MealRow | null) => void }) {
  const selectClass = "w-full h-8 bg-bg border border-border rounded-sm px-2 text-[11px] font-mono text-on-surface focus:outline-none focus:border-teal transition-colors"

  return (
    <select
      className={selectClass}
      onChange={(e) => {
        const id = e.target.value
        if (id === "__new") return
        onSelect(id ? meals.find((m) => m.id === id) ?? null : null)
      }}
      defaultValue=""
    >
      <option value="">—</option>
      {meals.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
      <option value="__new" style={{ color: "var(--color-teal)" }}>+ Nova receita...</option>
    </select>
  )
}

function AddMealForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("")
  const createMeal = useCreateMeal()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await createMeal.mutateAsync({
      name: name.trim(),
      kind: "recipe",
      tags: [],
      ingredients: [],
      prep_time: null,
      notes: null,
    })
    setName("")
    onCreated()
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nova receita..."
        className="flex-1 h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
      />
      <button
        type="submit"
        disabled={!name.trim() || createMeal.isPending}
        className="h-8 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors flex-none"
      >
        {createMeal.isPending ? "..." : "+ ADD"}
      </button>
    </form>
  )
}

export default function MealsPage() {
  const { data: meals = [] } = useMeals()
  const setMealPlan = useSetMealPlan()
  const [showNewMeal, setShowNewMeal] = useState(false)

  const weekDates = useMemo(() => getWeekDates(), [])
  const weekStart = useMemo(() => {
    const d = new Date(weekDates[0])
    d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1))
    return d.toISOString().slice(0, 10)
  }, [weekDates])

  const { data: plans = [] } = useMealPlans(weekStart)

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
                      const dateKey = d.toISOString().slice(0, 10)
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
                <MealRow key={meal.id} meal={meal} />
              ))}
            </div>
          </div>
        )}
      </div>
    </SectionErrorBoundary>
  )
}

function MealRow({ meal }: { meal: MealRow }) {
  const deleteMeal = useDeleteMeal()
  const createMeal = useCreateMeal()
  const toast = useUndoToast()
  const [confirmDelete, setConfirmDelete] = useState(false)

  function handleDelete() {
    const snap = { ...meal }
    deleteMeal.mutate(meal.id, {
      onSuccess: () => {
        toast.show({
          label: `"${snap.name.slice(0, 40)}" excluída`,
          onUndo: () => {
            createMeal.mutate({
              name: snap.name,
              kind: snap.kind,
              tags: snap.tags ?? [],
              ingredients: snap.ingredients ?? [],
              prep_time: snap.prep_time,
              notes: snap.notes,
            })
          },
        })
      },
    })
  }

  return (
    <div className="flex items-center gap-3 h-10 px-4 hover:bg-surface-hover transition-colors">
      <span className="flex-1 text-[12px] font-mono text-on-surface truncate">{meal.name}</span>
      {meal.tags && meal.tags.length > 0 && (
        <span className="text-[9px] font-mono text-on-surface/30">{(meal.tags as string[]).join(", ")}</span>
      )}
      {meal.prep_time && (
        <span className="text-[10px] font-mono text-on-surface/30">{meal.prep_time}min</span>
      )}
      {confirmDelete ? (
        <div className="flex items-center gap-1">
          <button onClick={handleDelete} className="text-[8px] font-mono text-danger tracking-wider">DEL</button>
          <button onClick={() => setConfirmDelete(false)} className="text-on-surface/30 text-[14px]">×</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="text-on-surface/20 hover:text-danger transition-colors">×</button>
      )}
    </div>
  )
}
