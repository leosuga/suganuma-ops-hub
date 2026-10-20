"use client"

import Link from "next/link"
import { useChild } from "@/lib/queries/baby"
import { ageLabel } from "@/lib/baby/summary"
import { saoPauloDate } from "@/lib/baby/dates"
import { today } from "@/lib/date"

/** Card da bebê na tela de Saúde — substitui o PregnancyCard depois do nascimento. */
export function BabySummaryCard() {
  const { data: child } = useChild()
  if (!child) return null
  const [y, m, d] = saoPauloDate(child.birth_at).split("-")

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[9px] font-mono font-semibold tracking-widest uppercase text-health">BEBÊ</span>
        <Link href="/baby" className="text-[9px] font-mono text-on-surface/60 hover:text-on-surface/70">
          ABRIR →
        </Link>
      </div>
      <div className="p-4">
        <p className="text-[18px] font-mono font-bold text-health leading-none">{child.name}</p>
        <p className="text-[11px] font-mono text-on-surface/60 mt-1.5">
          {ageLabel(child.birth_at, today())} · nasceu em {d}/{m}/{y}
          {child.birth_weight_g ? ` · ${child.birth_weight_g} g` : ""}
        </p>
      </div>
    </div>
  )
}
