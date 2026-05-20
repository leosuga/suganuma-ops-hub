"use client"

import { useProtocols, useProtocolEntries } from "@/lib/queries/health"

export function ProtocolsSummary() {
  const { data: protocols = [] } = useProtocols()
  const active = protocols.filter((p) => p.active)
  const today = new Date().toISOString().slice(0, 10)

  const checks = active.map((p) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { data: entries = [] } = useProtocolEntries(p.id)
    return entries.some((e) => e.done_on === today)
  })

  const doneCount = checks.filter(Boolean).length
  const total = active.length

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
