"use client"

import { useState, useMemo } from "react"
import { useTitle } from "@/lib/useTitle"
import { useHabits, useCreateHabit } from "@/lib/queries/habits"
import { cn } from "@/lib/utils"
import { today, dateStr, addDays } from "@/lib/date"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { HabitStats } from "@/components/habits/HabitStats"
import { HabitRow } from "@/components/habits/HabitRow"

function getLast7Days() {
  const days: string[] = []
  const base = new Date()
  for (let i = 6; i >= 0; i--) {
    days.push(dateStr(addDays(base, -i)))
  }
  return days
}

export default function HabitsPage() {
  useTitle("Habits · Suganuma Ops Hub")
  const { data: habits = [], isLoading } = useHabits()
  const createHabit = useCreateHabit()
  const [newName, setNewName] = useState("")
  const [adding, setAdding] = useState(false)

  const weekDays = useMemo(() => getLast7Days(), [])
  const active = habits.filter((h) => h.active)
  const inactive = habits.filter((h) => !h.active)

  const dayLabels = useMemo(() =>
    weekDays.map((d) => new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "short" }).slice(0, 3)),
    [weekDays]
  )

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    await createHabit.mutateAsync({ name: newName.trim(), active: true })
    setNewName("")
    setAdding(false)
  }

  return (
    <SectionErrorBoundary label="HABITS">
      <div className="h-full flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between flex-none">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-mono font-semibold tracking-[0.2em] text-on-surface/40 uppercase">
              HABITS TRACKER
            </span>
            <span className="text-[10px] font-mono text-on-surface/20">
              {active.length} ativo{active.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="h-7 px-3 bg-teal/10 border border-teal/40 text-teal font-mono text-[9px] font-semibold tracking-widest rounded-sm hover:bg-teal/20 transition-colors"
          >
            + NOVO HÁBITO
          </button>
        </div>

        {adding && (
          <form onSubmit={handleAdd} className="px-4 py-3 border-b border-border flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do hábito..."
              autoFocus
              className="flex-1 h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
            />
            <button type="submit" disabled={!newName.trim() || createHabit.isPending} className="h-8 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors">
              {createHabit.isPending ? "..." : "ADD"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="text-on-surface/30 hover:text-on-surface/60 text-[14px]">×</button>
          </form>
        )}

        {!isLoading && <HabitStats habits={habits} />}

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-4">
              {[0, 1, 2, 3].map((i) => <div key={i} className="h-10 border-b border-border animate-pulse" />)}
            </div>
          ) : habits.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 p-4">
              <span className="text-[11px] font-mono text-on-surface/20">Nenhum hábito ainda</span>
              <button onClick={() => setAdding(true)} className="text-[10px] font-mono text-teal hover:text-teal-hi transition-colors">+ Criar primeiro hábito</button>
            </div>
          ) : (
            <div>
              <div className="flex items-center h-8 px-4 border-b border-border bg-bg sticky top-0 z-10">
                <div className="w-32 flex-none" />
                <div className="flex-1 flex items-center gap-1 justify-center">
                  {dayLabels.map((l) => (
                    <span key={l} className="w-6 text-center text-[7px] font-mono text-on-surface/20 uppercase">{l}</span>
                  ))}
                </div>
                <div className="w-20 flex-none" />
              </div>
              {active.map((h) => <HabitRow key={h.id} habit={h} weekDays={weekDays} />)}
              {inactive.map((h) => <HabitRow key={h.id} habit={h} weekDays={weekDays} />)}
            </div>
          )}
        </div>
      </div>
    </SectionErrorBoundary>
  )
}
