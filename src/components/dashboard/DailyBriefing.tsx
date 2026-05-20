"use client"

import Link from "next/link"
import type { AppointmentRow } from "@/lib/queries/health"
import type { MealPlanRow } from "@/lib/queries/meals"
import type { NoteRow } from "@/lib/queries/notes"

interface DailyBriefingProps {
  pendingCount: number
  doneCount: number
  urgentCount: number
  todayAppts: AppointmentRow[]
  todayMeals: MealPlanRow[]
  todayNotes: NoteRow[]
}

export function DailyBriefing({
  pendingCount,
  doneCount,
  urgentCount,
  todayAppts,
  todayMeals,
  todayNotes,
}: DailyBriefingProps) {
  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase">
          HOJE
        </span>
      </div>
      <div className="p-3 space-y-1">
        <span className="text-[10px] font-mono text-on-surface/50">
          {pendingCount} tasks · {doneCount} concluídas · {urgentCount} urgentes
        </span>
        {todayAppts.length > 0 && (
          <span className="text-[10px] font-mono text-health block">
            {todayAppts.map(a => {
              const t = new Date(a.starts_at)
              return t.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) + " " + a.title
            }).join(" · ")}
          </span>
        )}
        {todayMeals.length > 0 && (
          <span className="text-[10px] font-mono text-amber block">
            Refeições: {todayMeals.map(m => m.meal_type === "breakfast" ? "café" : m.meal_type === "lunch" ? "almoço" : m.meal_type === "dinner" ? "janta" : "lanche").join(", ")}
          </span>
        )}
        {todayNotes.length > 0 && (
          <span className="text-[10px] font-mono text-on-surface/40 block">
            Notas fixadas: {todayNotes.map(n => n.title).join(", ")}
          </span>
        )}
        {pendingCount === 0 && todayAppts.length === 0 && todayMeals.length === 0 && (
          <span className="text-[10px] font-mono text-on-surface/20">Nada agendado para hoje</span>
        )}
        <div className="flex gap-2 pt-1">
          <Link href="/calendar" className="text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">CALENDÁRIO →</Link>
          <Link href="/meals" className="text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">REFEIÇÕES →</Link>
          <Link href="/notes" className="text-[9px] font-mono text-on-surface/20 hover:text-on-surface/60 transition-colors">NOTAS →</Link>
        </div>
      </div>
    </div>
  )
}
