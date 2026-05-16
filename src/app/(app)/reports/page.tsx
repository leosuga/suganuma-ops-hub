"use client"

import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"

export default function ReportsPage() {
  useTitle("Reports · Suganuma Ops Hub")

  return (
    <SectionErrorBoundary label="REPORTS">
      <div className="p-4 space-y-6">
        <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
          REPORTS
        </h1>
        <p className="text-[10px] font-mono text-on-surface/30">
          Analytics dashboard em desenvolvimento. KPIs e gráficos serão adicionados em breve.
        </p>
      </div>
    </SectionErrorBoundary>
  )
}
