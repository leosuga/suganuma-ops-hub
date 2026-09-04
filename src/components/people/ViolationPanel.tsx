"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"
import type { Violation } from "@/lib/people/conflicts"
import { VIOLATION_LEVEL_LABEL, VETO_LABEL } from "@/lib/people/labels"

const LEVEL_STYLE: Record<Violation["level"], string> = {
  block: "border-danger/40 bg-danger/10 text-danger",
  warn: "border-amber/40 bg-amber/10 text-amber",
  info: "border-on-surface/20 bg-on-surface/5 text-on-surface/70",
}

export const ViolationPanel = memo(function ViolationPanel({
  violations,
}: {
  violations: Violation[]
}) {
  if (violations.length === 0) {
    return (
      <div className="mb-3 border border-on-surface/20 bg-on-surface/5 px-3 py-2 font-mono text-[11px] text-on-surface/50">
        Nenhum conflito nesta lista.
      </div>
    )
  }

  const blocks = violations.filter((v) => v.level === "block").length

  return (
    <div className="mb-3 space-y-1">
      {blocks > 0 ? (
        <p className="font-mono text-[11px] text-danger">
          {blocks} bloqueio(s) — resolva antes de enviar os convites.
        </p>
      ) : null}
      {violations.map((v, i) => (
        <div
          key={`${v.conflictId}-${v.level}-${i}`}
          className={cn("flex items-start gap-2 border px-2 py-1.5", LEVEL_STYLE[v.level])}
        >
          <span className="shrink-0 font-mono text-[10px]">{VIOLATION_LEVEL_LABEL[v.level]}</span>
          <span className="flex-1 text-[13px]">
            {v.message}
            {/* §4 do spec: a tela de curadoria precisa deixar visível de quem
                é a decisão — antes só a ficha da pessoa mostrava isso. */}
            <span className="ml-2 font-mono text-[10px] opacity-60">
              ({VETO_LABEL[v.vetoOwner]})
            </span>
          </span>
        </div>
      ))}
    </div>
  )
})
