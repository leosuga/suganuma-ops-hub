"use client"

import { useMemo } from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
} from "recharts"
import { useTitle } from "@/lib/useTitle"
import { useReports } from "@/lib/queries/reports"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { cn } from "@/lib/utils"

function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

function StatCard({
  label,
  value,
  sub,
  color = "text-on-surface",
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="border border-border bg-surface rounded-sm p-4 flex flex-col gap-1">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
        {label}
      </span>
      <span className={`text-[24px] font-mono font-bold leading-none ${color}`}>{value}</span>
      {sub && (
        <span className="text-[10px] font-mono text-on-surface/30">{sub}</span>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-sm px-3 py-2 text-[10px] font-mono">
      <p className="text-on-surface/40 mb-1">{label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" && p.value > 1000 ? fmtBRL(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

export default function ReportsPage() {
  useTitle("Reports · Suganuma Ops Hub")
  const { data: report, isLoading, isError } = useReports()

  if (isLoading) {
    return (
      <SectionErrorBoundary label="REPORTS">
        <div className="p-4 space-y-5">
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">REPORTS</h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="border border-border bg-surface rounded-sm h-20 animate-pulse" />
            ))}
          </div>
        </div>
      </SectionErrorBoundary>
    )
  }

  if (isError || !report) {
    return (
      <SectionErrorBoundary label="REPORTS">
        <div className="p-4">
          <p className="text-[11px] font-mono text-danger">Erro ao carregar relatórios. Tente novamente.</p>
        </div>
      </SectionErrorBoundary>
    )
  }

  const { tasks, finance, habits } = report

  // Finance category data sorted by expense
  const financeCatData = useMemo(() => {
    return Object.entries(finance.byCategory)
      .sort((a, b) => b[1].expense - a[1].expense)
      .slice(0, 6)
      .map(([name, vals]) => ({ name, expense: vals.expense, income: vals.income }))
  }, [finance.byCategory])

  return (
    <SectionErrorBoundary label="REPORTS">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">REPORTS</h1>
          <p className="text-[10px] font-mono text-on-surface/30 mt-0.5">
            {new Date(report.dateRange.from).toLocaleDateString("pt-BR")} → {new Date(report.dateRange.to).toLocaleDateString("pt-BR")}
          </p>
        </div>

        {/* ── TASKS ───────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-teal" />
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">TASKS</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              label="Conclusão"
              value={`${tasks.completionRate}%`}
              sub={`${tasks.done}/${tasks.total} tasks`}
              color={tasks.completionRate >= 70 ? "text-teal" : tasks.completionRate >= 40 ? "text-amber" : "text-danger"}
            />
            <StatCard label="Pendentes" value={tasks.pending} sub={`${tasks.urgent} urgentes`} />
            <StatCard label="Atrasadas" value={tasks.overdue} sub="fora do prazo" color={tasks.overdue > 0 ? "text-amber" : "text-on-surface"} />
            <StatCard label="Urgentes" value={tasks.urgent} sub="requerem atenção" color={tasks.urgent > 0 ? "text-danger" : "text-on-surface"} />
          </div>

          {/* Tasks by Category */}
          <div className="border border-border bg-surface rounded-sm p-4">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
              POR CATEGORIA
            </span>
            <div className="space-y-2">
              {(["finance", "logistics", "personal", "health"] as const).map((cat) => {
                const c = tasks.byCategory[cat]
                const rate = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-on-surface/60 w-20 uppercase">{cat}</span>
                    <div className="flex-1 h-2 bg-bg rounded-sm overflow-hidden">
                      <div
                        className="h-full rounded-sm"
                        style={{
                          width: `${rate}%`,
                          backgroundColor: rate >= 70 ? "#55D7ED" : rate >= 40 ? "#FFBB52" : "#FFB4AB",
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-on-surface/40 w-12 text-right">{rate}%</span>
                    <span className="text-[10px] font-mono text-on-surface/30 w-16 text-right">{c.pending} pen</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Weekly Trend */}
          <div className="border border-border bg-surface rounded-sm p-4">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
              TENDÊNCIA SEMANAL
            </span>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={tasks.weeklyTrend} barCategoryGap="20%">
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 9, fontFamily: "ui-monospace", fill: "rgba(222,227,229,0.3)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="done" fill="#55D7ED" radius={[2, 2, 0, 0]} name="Concluídas" />
                <Bar dataKey="created" fill="rgba(222,227,229,0.15)" radius={[2, 2, 0, 0]} name="Criadas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── FINANCE ──────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-teal" />
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">FINANCE</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Receita Total" value={fmtBRL(finance.totalIncome)} color="text-teal" />
            <StatCard label="Despesa Total" value={fmtBRL(finance.totalExpense)} color="text-danger" />
            <StatCard
              label="Saldo"
              value={fmtBRL(finance.balance)}
              color={finance.balance >= 0 ? "text-teal" : "text-danger"}
            />
            <StatCard
              label="Média Diária"
              value={`${fmtBRL(finance.dailyAverage.expense)}`}
              sub="despesa/dia"
              color="text-amber"
            />
          </div>

          {/* Monthly Trend */}
          <div className="border border-border bg-surface rounded-sm p-4">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
              FLUXO MENSAL
            </span>
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={finance.monthlyTrend} barCategoryGap="30%">
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 9, fontFamily: "ui-monospace", fill: "rgba(222,227,229,0.3)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (!active || !payload?.length) return null
                    return (
                      <div className="bg-surface border border-border rounded-sm px-3 py-2 text-[10px] font-mono">
                        <p className="text-on-surface/40 mb-1">{label}</p>
                        {payload.map((p: any) => (
                          <p key={p.name} style={{ color: p.color }}>
                            {p.name === "income" ? "Receita" : p.name === "expense" ? "Despesa" : "Saldo"}: {fmtBRL(p.value)}
                          </p>
                        ))}
                      </div>
                    )
                  }}
                  cursor={{ fill: "rgba(255,255,255,0.03)" }}
                />
                <Bar dataKey="income" fill="#55D7ED" radius={[2, 2, 0, 0]} name="income" />
                <Bar dataKey="expense" fill="#FFB4AB" radius={[2, 2, 0, 0]} name="expense" />
                <Bar dataKey="balance" fill="rgba(168,216,176,0.4)" radius={[2, 2, 0, 0]} name="balance" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* By Category */}
          <div className="border border-border bg-surface rounded-sm p-4">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
              DESPESA POR CATEGORIA
            </span>
            <div className="space-y-2">
              {financeCatData.map((cat) => {
                const max = Math.max(...financeCatData.map((c) => c.expense), 1)
                const pct = (cat.expense / max) * 100
                return (
                  <div key={cat.name} className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-on-surface/60 w-24 truncate capitalize">{cat.name}</span>
                    <div className="flex-1 h-2 bg-bg rounded-sm overflow-hidden">
                      <div className="h-full rounded-sm bg-danger" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] font-mono text-on-surface/40 w-20 text-right">{fmtBRL(cat.expense)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── HABITS ───────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-1 rounded-full bg-health" />
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">HABITS</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Hábitos Ativos" value={habits.active} sub="em tracking" color="text-health" />
            <StatCard label="Total Entries" value={habits.totalEntries} sub="registros" />
            <StatCard
              label="Best Streak"
              value={Math.max(...habits.streaks.map((s) => s.best), 0)}
              sub="dias consecutivos"
              color="text-teal"
            />
            <StatCard
              label="Current Streak"
              value={Math.max(...habits.streaks.map((s) => s.streak), 0)}
              sub="dias seguidos"
              color="text-health"
            />
          </div>

          {/* Streaks Table */}
          {habits.streaks.length > 0 && (
            <div className="border border-border bg-surface rounded-sm overflow-hidden">
              <div className="px-4 py-2 border-b border-border">
                <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
                  STREAKS
                </span>
              </div>
              <div className="divide-y divide-border">
                {habits.streaks
                  .sort((a, b) => b.streak - a.streak)
                  .map((s) => (
                    <div key={s.habitId} className="flex items-center gap-3 h-10 px-4">
                      <span className="flex-1 text-[12px] font-mono text-on-surface truncate">{s.name}</span>
                      <span className={cn(
                        "text-[11px] font-mono tabular-nums",
                        s.streak >= 7 ? "text-health" : s.streak >= 3 ? "text-teal" : "text-on-surface/40"
                      )}>
                        {s.streak}d
                      </span>
                      <span className="text-[10px] font-mono text-on-surface/20 w-12 text-right">
                        best {s.best}d
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Weekly Heatmap */}
          <div className="border border-border bg-surface rounded-sm p-4">
            <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
              HEATMAP (14 DIAS)
            </span>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={habits.weeklyHeatmap} barCategoryGap="10%">
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 8, fontFamily: "ui-monospace", fill: "rgba(222,227,229,0.3)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide />
                <Bar dataKey="count" radius={[2, 2, 0, 0]} name="entries">
                  {habits.weeklyHeatmap.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        entry.count === 0
                          ? "rgba(222,227,229,0.05)"
                          : entry.count <= 2
                            ? "rgba(168,216,176,0.4)"
                            : entry.count <= 4
                              ? "rgba(168,216,176,0.6)"
                              : "#A8D8B0"
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </SectionErrorBoundary>
  )
}