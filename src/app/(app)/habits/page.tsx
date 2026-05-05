"use client"

import { useState, useMemo } from "react"
import { useHabits, useCreateHabit, useUpdateHabit, useDeleteHabit, useHabitEntries, useLogHabitEntry, useDeleteHabitEntry } from "@/lib/queries/habits"
import type { HabitTrackRow } from "@/lib/queries/habits"
import { cn } from "@/lib/utils"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { useUndoToast } from "@/components/UndoToast"

function getLast7Days() {
  const days: string[] = []
  const today = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

function HabitRow({ habit, weekDays }: { habit: HabitTrackRow; weekDays: string[] }) {
  const { data: entries = [] } = useHabitEntries(habit.id)
  const logEntry = useLogHabitEntry()
  const deleteEntry = useDeleteHabitEntry()
  const updateHabit = useUpdateHabit()
  const deleteHabit = useDeleteHabit()
  const createHabit = useCreateHabit()
  const toast = useUndoToast()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(habit.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const today = new Date().toISOString().slice(0, 10)
  const doneToday = entries.some((e) => e.done_on === today)

  const daySet = new Set(entries.map((e) => e.done_on))

  async function handleToggle(day: string) {
    const already = entries.some((e) => e.done_on === day)
    if (already) {
      const entry = entries.find((e) => e.done_on === day)
      if (entry) {
        await deleteEntry.mutateAsync({ id: entry.id, habit_id: habit.id })
      }
    } else {
      await logEntry.mutateAsync({ habit_id: habit.id, done_on: day, notes: null })
    }
  }

  async function handleSaveEdit() {
    if (!editName.trim()) return
    await updateHabit.mutateAsync({ id: habit.id, name: editName.trim() })
    setEditing(false)
  }

  async function handleToggleActive() {
    await updateHabit.mutateAsync({ id: habit.id, active: !habit.active })
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 h-10 px-4 border-b border-border">
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") setEditing(false) }}
          autoFocus
          className="flex-1 h-7 bg-bg border border-border rounded-sm px-2 text-[12px] font-mono text-on-surface focus:outline-none focus:border-teal transition-colors"
        />
        <button onClick={handleSaveEdit} disabled={updateHabit.isPending} className="text-[9px] font-mono text-teal tracking-wider">OK</button>
        <button onClick={() => setEditing(false)} className="text-on-surface/30 text-[14px]">×</button>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center h-10 px-4 border-b border-border hover:bg-surface-hover transition-colors", !habit.active && "opacity-40")}>
      <div className="w-32 flex-none min-w-0">
        <span className="text-[12px] font-mono text-on-surface truncate block">{habit.name}</span>
      </div>
      <div className="flex-1 flex items-center gap-1 justify-center">
        {weekDays.map((day) => {
          const done = daySet.has(day)
          const isToday = day === today
          const canToggle = day <= today
          return (
            <button
              key={day}
              onClick={() => canToggle && handleToggle(day)}
              disabled={!canToggle || logEntry.isPending}
              className={cn(
                "w-6 h-6 rounded-[3px] border transition-colors flex items-center justify-center",
                done
                  ? "bg-teal border-teal"
                  : isToday
                    ? "border-teal/40"
                    : "border-border/40"
              )}
              title={day.slice(5)}
            >
              {done && (
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" className="text-bg">
                  <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
      <div className="w-20 flex-none flex items-center justify-end gap-1">
        <button onClick={() => { setEditName(habit.name); setEditing(true) }} className="w-5 h-5 flex items-center justify-center text-on-surface/20 hover:text-teal transition-colors text-[11px]">✎</button>
        <button onClick={handleToggleActive} className={cn("text-[8px] font-mono tracking-wider", habit.active ? "text-on-surface/20 hover:text-on-surface/50" : "text-teal")}>{habit.active ? "⊘" : "⊕"}</button>
        {confirmDelete ? (
          <>
            <button onClick={() => {
              const snap = { ...habit }
              deleteHabit.mutate(habit.id, {
                onSuccess: () => {
                  toast.show({
                    label: `"${snap.name.slice(0, 40)}" excluído`,
                    onUndo: () => {
                      createHabit.mutate({ name: snap.name, active: snap.active })
                    },
                  })
                },
              })
            }} className="text-[8px] font-mono text-danger tracking-wider">DEL</button>
            <button onClick={() => setConfirmDelete(false)} className="text-on-surface/30 text-[14px]">×</button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-on-surface/20 hover:text-danger transition-colors">×</button>
        )}
      </div>
    </div>
  )
}

export default function HabitsPage() {
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
