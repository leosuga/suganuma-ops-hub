"use client"

import { StatCard } from "./StatCard"

interface TaskKPIsProps {
  pending: number
  done: number
  urgent: number
  overdue: number
  isLoading: boolean
}

export function TaskKPIs({ pending, done, urgent, overdue, isLoading }: TaskKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border border-border bg-surface rounded-sm p-4 h-20 animate-pulse" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Pendentes" value={pending} sub="tasks abertas" color={pending > 10 ? "text-amber" : "text-on-surface"} />
      <StatCard label="Concluídas" value={done} sub="tasks hoje" color="text-teal" />
      <StatCard label="Urgentes" value={urgent} sub="requerem atenção" color={urgent > 0 ? "text-danger" : "text-on-surface"} />
      <StatCard label="Atrasadas" value={overdue} sub="fora do prazo" color={overdue > 0 ? "text-amber" : "text-on-surface"} />
    </div>
  )
}
