"use client"

import { useMemo } from "react"
import Link from "next/link"
import { useChild, useBabyLogs } from "@/lib/queries/baby"
import { summarize24h, ageShort } from "@/lib/baby/summary"
import { useNow } from "@/lib/useNow"
import { today } from "@/lib/date"
import { BabyStatusStrip } from "./BabyStatusStrip"
import { QuickLogPanel } from "./QuickLogPanel"

/** Resumo + registro rápido da bebê no topo do Cockpit. Não renderiza sem criança cadastrada. */
export function BabyCockpitWidget() {
  const now = useNow()
  const { data: child } = useChild()
  const { data: logs = [] } = useBabyLogs(child?.id)
  const summary = useMemo(() => summarize24h(logs, now), [logs, now])

  if (!child) return null
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-health uppercase">
          {child.name} · {ageShort(child.birth_at, today())}
        </span>
        <Link href="/baby" className="text-[9px] font-mono text-on-surface/40 hover:text-on-surface/70">
          ABRIR →
        </Link>
      </div>
      <BabyStatusStrip summary={summary} />
      <QuickLogPanel childId={child.id} logs={logs} compact />
    </div>
  )
}
