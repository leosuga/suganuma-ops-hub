"use client"

import { useState } from "react"
import { useCreateMeal } from "@/lib/queries/meals"

interface AddMealFormProps {
  onCreated: () => void
}

export function AddMealForm({ onCreated }: AddMealFormProps) {
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
        className="flex-1 h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/40 focus:outline-none focus:border-teal transition-colors"
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
