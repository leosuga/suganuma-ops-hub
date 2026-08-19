"use client"

import { useState } from "react"
import { useHabitEntries, useLogHabitEntry, useDeleteHabitEntry, useUpdateHabit, useDeleteHabit, useCreateHabit } from "@/lib/queries/habits"
import type { HabitTrackRow } from "@/lib/queries/habits"
import { cn } from "@/lib/utils"
import { today } from "@/lib/date"
import { useUndoToast } from "@/components/UndoToast"

interface HabitRowProps {
  habit: HabitTrackRow
  weekDays: string[]
}

export function HabitRow({ habit, weekDays }: HabitRowProps) {
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

  const todayStr = today()
  const doneToday = entries.some((e) => e.done_on === todayStr)

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
        <button onClick={() => setEditing(false)} className="text-on-surface/40 text-[14px]">×</button>
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
          const isToday = day === todayStr
          const canToggle = day <= todayStr
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
        <button onClick={() => { setEditName(habit.name); setEditing(true) }} className="w-5 h-5 flex items-center justify-center text-on-surface/40 hover:text-teal transition-colors text-[11px]">✎</button>
        <button onClick={handleToggleActive} className={cn("text-[8px] font-mono tracking-wider", habit.active ? "text-on-surface/40 hover:text-on-surface/50" : "text-teal")}>{habit.active ? "⊘" : "⊕"}</button>
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
            <button onClick={() => setConfirmDelete(false)} className="text-on-surface/40 text-[14px]">×</button>
          </>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-on-surface/40 hover:text-danger transition-colors">×</button>
        )}
      </div>
    </div>
  )
}
