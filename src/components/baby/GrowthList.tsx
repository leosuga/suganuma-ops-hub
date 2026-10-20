"use client"

import type { BabyLogRow, ChildRow } from "@/lib/queries/baby"
import { saoPauloDate } from "@/lib/baby/dates"
import { weightChangePct } from "@/lib/baby/summary"

function fmtDate(iso: string): string {
  const [, m, d] = saoPauloDate(iso).split("-")
  return `${d}/${m}`
}

export function GrowthList({ child, growth }: { child: ChildRow; growth: BabyLogRow[] }) {
  return (
    <section className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="h-8 px-4 flex items-center border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase">
          CRESCIMENTO
        </span>
      </div>
      <div className="divide-y divide-border">
        {growth.map((g) => {
          const w = typeof g.data.weight_g === "number" ? g.data.weight_g : null
          const pct = w !== null ? weightChangePct(child.birth_weight_g, w) : null
          return (
            <div key={g.id} className="flex items-center gap-3 min-h-[36px] px-4 text-[11px] font-mono">
              <span className="w-11 flex-none text-on-surface/60">{fmtDate(g.started_at)}</span>
              <span className="flex-1 text-on-surface">
                {[
                  w !== null ? `${w} g` : null,
                  typeof g.data.length_cm === "number" ? `${g.data.length_cm} cm` : null,
                  typeof g.data.head_cm === "number" ? `PC ${g.data.head_cm}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
              {pct !== null && (
                <span className="text-on-surface/60">
                  {pct >= 0 ? "+" : ""}
                  {pct.toFixed(1).replace(".", ",")}% vs nasc.
                </span>
              )}
            </div>
          )
        })}
        <div className="flex items-center gap-3 min-h-[36px] px-4 text-[11px] font-mono text-on-surface/60">
          <span className="w-11 flex-none">{fmtDate(child.birth_at)}</span>
          <span>
            Nascimento ·{" "}
            {[
              child.birth_weight_g ? `${child.birth_weight_g} g` : null,
              child.birth_length_cm ? `${child.birth_length_cm} cm` : null,
              child.birth_head_cm ? `PC ${child.birth_head_cm}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || "sem medidas"}
          </span>
        </div>
      </div>
    </section>
  )
}
