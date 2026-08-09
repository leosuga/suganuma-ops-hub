"use client"

import { useMemo } from "react"
import { useProtocols, useAllProtocolEntries } from "@/lib/queries/health"

export function ProtocolsSummary() {
  const { data: protocols = [] } = useProtocols()
  const { data: entries = [] } = useAllProtocolEntries()
  const today = new Date().toISOString().slice(0, 10)

  const { doneCount, total } = useMemo(() => {
    const activeIds = new Set(protocols.filter((p) => p.active).map((p) => p.id))
    const doneSet = new Set(
      entries
        .filter((e) => e.done_on === today && activeIds.has(e.protocol_id))
        .map((e) => e.protocol_id)
    )
    return { doneCount: doneSet.size, total: activeIds.size }
  }, [protocols, entries, today])

  if (total === 0) return null

  return (
    <div className="border border-border bg-surface rounded-sm p-4 flex flex-col gap-1">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
        PROTOCOLOS
      </span>
      <span className={`text-[28px] font-mono font-bold leading-none ${doneCount === total ? "text-health" : "text-on-surface"}`}>
        {doneCount}/{total}
      </span>
      <span className="text-[10px] font-mono text-on-surface/30">feitos hoje</span>
    </div>
  )
}
