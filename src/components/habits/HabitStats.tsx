"use client"

import { useMemo } from "react"
import type { HabitTrackRow } from "@/lib/queries/habits"
import { useAllHabitEntries } from "@/lib/queries/habits"
import { cn } from "@/lib/utils"

function startOfWeek(d: Date) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

const DAY_NAMES = ["SEG", "TER", "QUA", "QUI", "SEX", "SAB", "DOM"]

interface HabitStatsProps {
  habits: HabitTrackRow[]
}

export function HabitStats({ habits }: HabitStatsProps) {
  const { data: entries = [], isLoading } = useAllHabitEntries(400)

  const stats = useMemo(() => {
    if (isLoading || habits.length === 0) return null

    const active = habits.filter((h) => h.active)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const weekStart = startOfWeek(new Date())
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    const weekDays: Date[] = []
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      weekDays.push(d)
    }
    const activeDays = weekDays.filter((day) => day <= now).length

    const entrySet = new Set<string>()
    for (const e of entries) {
      entrySet.add(`${e.habit_id}::${new Date(e.done_on).toDateString()}`)
    }

    let bestStreak = 0
    let bestStreakName = ""
    for (const h of active) {
      const days = new Set(
        entries
          .filter((e) => e.habit_id === h.id)
          .map((e) => new Date(e.done_on).toDateString())
      )
      let streak = 0
      let check = new Date(now)
      while (days.has(check.toDateString())) {
        streak++
        check.setDate(check.getDate() - 1)
      }
      if (streak > bestStreak) {
        bestStreak = streak
        bestStreakName = h.name
      }
    }

    const totalChecks = weekDays.slice(0, activeDays).reduce((count, day) => {
      for (const h of active) {
        if (entrySet.has(`${h.id}::${day.toDateString()}`)) count++
      }
      return count
    }, 0)
    const maxChecks = active.length * activeDays
    const weekRate = maxChecks > 0 ? Math.round((totalChecks / maxChecks) * 100) : 0

    return { active, now, weekDays, activeDays, entrySet, bestStreak, bestStreakName, weekRate }
  }, [habits, entries, isLoading])

  if (!stats) return null

  const { active, now, weekDays, activeDays, entrySet, bestStreak, bestStreakName, weekRate } = stats

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-border bg-surface rounded-sm p-4">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block">
            MELHOR STREAK
          </span>
          <span className="text-xl font-mono font-bold text-health block">{bestStreak}d</span>
          {bestStreakName && (
            <span className="text-[10px] font-mono text-on-surface/30 block mt-1 truncate">{bestStreakName}</span>
          )}
        </div>

        <div className="border border-border bg-surface rounded-sm p-4">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block">
            CONSISTÊNCIA
          </span>
          <span className="text-xl font-mono font-bold text-teal block">{weekRate}%</span>
          <span className="text-[10px] font-mono text-on-surface/30 block mt-1">desta semana</span>
        </div>

        <div className="border border-border bg-surface rounded-sm p-4">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block">
            ATIVOS
          </span>
          <span className="text-xl font-mono font-bold text-on-surface block">{active.length}</span>
          <span className="text-[10px] font-mono text-on-surface/30 block mt-1">
            {habits.length - active.length} inativos
          </span>
        </div>
      </div>

      {active.length > 0 && (
        <div className="border border-border bg-surface rounded-sm p-4 overflow-x-auto">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
            VISÃO SEMANAL
          </span>
          <div className="min-w-max">
            <div
              className="grid gap-x-1"
              style={{ gridTemplateColumns: `100px repeat(${activeDays}, minmax(24px, 1fr))` }}
            >
              <div className="text-[9px] font-mono text-on-surface/20" />
              {weekDays.slice(0, activeDays).map((day) => (
                <div key={day.toISOString()} className="text-center">
                  <span className="text-[7px] font-mono text-on-surface/25 uppercase">
                    {DAY_NAMES[day.getDay() === 0 ? 6 : day.getDay() - 1]}
                  </span>
                </div>
              ))}

              {active.map((habit) => (
                <div key={habit.id} className="contents">
                  <div className="text-[10px] font-mono text-on-surface/50 flex items-center gap-1 py-1.5 truncate">
                    <span className="text-[11px]">{habit.emoji || "\u25CF"}</span>
                    <span className="truncate">{habit.name}</span>
                  </div>
                  {weekDays.slice(0, activeDays).map((day) => {
                    const done = entrySet.has(`${habit.id}::${day.toDateString()}`)
                    return (
                      <div key={`${habit.id}-${day.toISOString()}`} className="flex items-center justify-center py-1.5">
                        <div
                          className={cn(
                            "w-5 h-5 rounded-[3px] border transition-colors",
                            done
                              ? "bg-teal border-teal"
                              : day.getDay() === now.getDay() && day <= now
                                ? "border-teal/40"
                                : "border-border/40"
                          )}
                        />
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
