"use client"

import { useMemo } from "react"
import type { TaskRow } from "@/lib/queries/tasks"
import { useHabits, useAllHabitEntries } from "@/lib/queries/habits"

function startOfWeek(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

const DAY_NAMES = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"]

interface WeeklyReviewProps {
  tasks: TaskRow[]
}

export function WeeklyReview({ tasks }: WeeklyReviewProps) {
  const { data: allHabits = [] } = useHabits()
  const { data: entries = [], isLoading } = useAllHabitEntries(300)

  const { completedThisWeek, createdThisWeek, pendingNow, entrySet, habitTracks, weekDays, activeDays } = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const ws = startOfWeek(new Date())
    const we = new Date(ws)
    we.setDate(we.getDate() + 7)

    const days: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(ws)
      d.setDate(d.getDate() + i)
      days.push(d)
    }

    const completed = tasks.filter((t) => {
      if (!t.completed_at) return false
      const d = new Date(t.completed_at)
      return d >= ws && d < we
    }).length

    const created = tasks.filter((t) => {
      const d = new Date(t.created_at)
      return d >= ws && d < we
    }).length

    const pending = tasks.filter((t) => t.status === "todo" || t.status === "doing").length

    const eSet = new Set<string>()
    for (const e of entries) {
      eSet.add(`${e.habit_id}::${new Date(e.done_on).toDateString()}`)
    }

    const tracks = allHabits.filter((h) => h.active)
    const aDays = days.filter((day) => day <= now).length

    return { completedThisWeek: completed, createdThisWeek: created, pendingNow: pending, entrySet: eSet, habitTracks: tracks, weekDays: days, activeDays: aDays }
  }, [tasks, entries, allHabits])

  if (isLoading) return null

  const activeHabits = habitTracks.length

  return (
    <div className="border border-border bg-surface rounded-sm">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
          WEEKLY REVIEW
        </span>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-mono text-on-surface/40 tracking-wider uppercase">
              CONCLUÍDAS
            </span>
            <span className="text-2xl font-mono font-bold text-teal">
              {completedThisWeek}
            </span>
            <span className="text-[9px] font-mono text-on-surface/30">
              esta semana
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-mono text-on-surface/40 tracking-wider uppercase">
              CRIADAS
            </span>
            <span className="text-2xl font-mono font-bold text-on-surface">
              {createdThisWeek}
            </span>
            <span className="text-[9px] font-mono text-on-surface/30">
              esta semana
            </span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-mono text-on-surface/40 tracking-wider uppercase">
              PENDENTES
            </span>
            <span className={`text-2xl font-mono font-bold ${pendingNow > 0 ? "text-amber" : "text-green-400"}`}>
              {pendingNow}
            </span>
            <span className="text-[9px] font-mono text-on-surface/30">
              total atual
            </span>
          </div>
        </div>

        {activeHabits > 0 && (
          <div className="border-t border-border pt-4">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
              HÁBITOS
            </span>
            <div className="grid gap-x-1" style={{ gridTemplateColumns: `90px repeat(${activeDays}, minmax(16px, 1fr))` }}>
              <div className="text-[9px] font-mono text-on-surface/20" />
              {weekDays.slice(0, activeDays).map((day) => (
                <div key={day.toISOString()} className="text-center">
                  <span className="text-[7px] font-mono text-on-surface/25 uppercase">
                    {DAY_NAMES[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                  </span>
                </div>
              ))}

              {habitTracks.map((habit) => (
                <div key={habit.id} className="contents">
                  <div className="text-[10px] font-mono text-on-surface/50 flex items-center gap-1 py-1.5 truncate">
                    <span className="text-[11px]">{habit.emoji || "\u25CF"}</span>
                  </div>
                  {weekDays.slice(0, activeDays).map((day) => {
                    const done = entrySet.has(`${habit.id}::${day.toDateString()}`)
                    return (
                      <div key={`${habit.id}-${day.toISOString()}`} className="flex items-center justify-center py-1.5">
                        <div
                          className="w-3 h-3 rounded-[2px]"
                          style={{
                            backgroundColor: done
                              ? habit.color || "var(--color-health)"
                              : "rgba(222,227,229,0.06)",
                          }}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeHabits === 0 && (
          <div className="text-[10px] font-mono text-on-surface/20 text-center py-2">
            Nenhum hábito ativo
          </div>
        )}
      </div>
    </div>
  )
}
