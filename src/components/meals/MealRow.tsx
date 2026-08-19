"use client"

import { useState } from "react"
import { useDeleteMeal, useCreateMeal } from "@/lib/queries/meals"
import type { MealRow } from "@/lib/queries/meals"
import { useUndoToast } from "@/components/UndoToast"

interface MealRowProps {
  meal: MealRow
}

export function MealRow({ meal }: MealRowProps) {
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
        <span className="text-[9px] font-mono text-on-surface/40">{(meal.tags as string[]).join(", ")}</span>
      )}
      {meal.prep_time && (
        <span className="text-[10px] font-mono text-on-surface/40">{meal.prep_time}min</span>
      )}
      {confirmDelete ? (
        <div className="flex items-center gap-1">
          <button onClick={handleDelete} className="text-[8px] font-mono text-danger tracking-wider">DEL</button>
          <button onClick={() => setConfirmDelete(false)} className="text-on-surface/40 text-[14px]">×</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete(true)} className="text-on-surface/40 hover:text-danger transition-colors">×</button>
      )}
    </div>
  )
}
