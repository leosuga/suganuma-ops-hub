"use client"

import { WeightChart, BloodPressureChart } from "@/components/health/HealthTrends"
import { useHealthLogs } from "@/lib/queries/health"

export default function HealthCharts() {
  const { data: logs = [] } = useHealthLogs()

  if (logs.length === 0) return null

  const hasWeight = logs.some((l) => l.kind === "weight")
  const hasBp = logs.some((l) => l.kind === "blood_pressure")

  if (!hasWeight && !hasBp) return null

  return (
    <section className="space-y-3">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
        TENDÊNCIAS
      </span>
      {hasWeight && <WeightChart logs={logs} kind="weight" />}
      {hasBp && <BloodPressureChart logs={logs} kind="blood_pressure" />}
    </section>
  )
}
