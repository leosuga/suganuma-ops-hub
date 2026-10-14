"use client"

import { useMemo } from "react"
import { useTitle } from "@/lib/useTitle"
import { useNow } from "@/lib/useNow"
import { today } from "@/lib/date"
import { useChild, useBabyLogs, useBabyGrowth } from "@/lib/queries/baby"
import { ageLabel, summarize24h } from "@/lib/baby/summary"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { ChildSetupForm } from "@/components/baby/ChildSetupForm"
import { BabyStatusStrip } from "@/components/baby/BabyStatusStrip"
import { QuickLogPanel } from "@/components/baby/QuickLogPanel"
import { BabyTimeline } from "@/components/baby/BabyTimeline"
import { CareTimeline } from "@/components/baby/CareTimeline"
import { GrowthList } from "@/components/baby/GrowthList"
import { WarningSignsPanel } from "@/components/baby/WarningSignsPanel"

export default function BabyPage() {
  useTitle("Bebê · Suganuma Ops Hub")
  const now = useNow()
  const { data: child, isLoading } = useChild()
  const { data: logs = [] } = useBabyLogs(child?.id)
  const { data: growth = [] } = useBabyGrowth(child?.id)

  const todayStr = today()
  const summary = useMemo(() => summarize24h(logs, now), [logs, now])

  return (
    <SectionErrorBoundary label="BEBÊ">
      <div className="p-4 space-y-5">
        <div>
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-health uppercase">
            {child ? `${child.name} · ${ageLabel(child.birth_at, todayStr)}` : "BEBÊ"}
          </h1>
          <p className="text-[10px] font-mono text-on-surface/40 mt-0.5">
            Rotina, crescimento e cuidados do primeiro ano
          </p>
        </div>

        {isLoading && <div className="h-40 animate-pulse rounded-sm bg-surface" />}

        {!isLoading && !child && <ChildSetupForm />}

        {child && (
          <>
            <BabyStatusStrip summary={summary} />
            <QuickLogPanel childId={child.id} logs={logs} />
            <CareTimeline child={child} todayStr={todayStr} />
            <BabyTimeline logs={logs} todayStr={todayStr} />
            <GrowthList child={child} growth={growth} />
            <WarningSignsPanel />
          </>
        )}
      </div>
    </SectionErrorBoundary>
  )
}
