"use client"

import type { Summary24h } from "@/lib/baby/summary"
import { formatDuration, formatSince } from "@/lib/baby/quick-log"
import { cn } from "@/lib/utils"

const SIDE_LABEL = { L: "E", R: "D" } as const

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-mono text-on-surface/40 uppercase tracking-widest">{label}</span>
      <span className={cn("text-[13px] font-mono text-on-surface", tone)}>{value}</span>
    </div>
  )
}

export function BabyStatusStrip({ summary }: { summary: Summary24h }) {
  return (
    <div className="border border-border bg-surface rounded-sm p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
      <Stat
        label="Última mamada"
        value={summary.minutesSinceLastFeed === null ? "—" : formatSince(summary.minutesSinceLastFeed)}
        tone={summary.minutesSinceLastFeed !== null && summary.minutesSinceLastFeed >= 180 ? "text-amber" : undefined}
      />
      <Stat label="Próximo lado" value={summary.nextSide ? `Peito ${SIDE_LABEL[summary.nextSide]}` : "—"} />
      <Stat label="Mamadas 24h" value={String(summary.feeds)} />
      <Stat label="Fraldas 24h" value={`${summary.wet} xixi · ${summary.dirty} cocô`} />
      <Stat
        label="Sono 24h"
        value={`${formatDuration(summary.sleepMinutes)}${summary.sleeping ? " · dormindo" : ""}`}
      />
      <Stat
        label="Vitamina D"
        value={summary.vitDToday ? "✓ dada hoje" : "pendente"}
        tone={summary.vitDToday ? "text-health" : "text-amber"}
      />
    </div>
  )
}
