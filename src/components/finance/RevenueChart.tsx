"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import type { TransactionRow } from "@/lib/queries/finance"

interface RevenueChartProps {
  transactions: TransactionRow[]
  isLoading: boolean
}

function groupByDay(transactions: TransactionRow[]) {
  const map = new Map<string, { income: number; expense: number }>()

  for (const txn of transactions) {
    const day = String(new Date(txn.occurred_on + "T12:00:00").getUTCDate()).padStart(2, "0")
    const prev = map.get(day) ?? { income: 0, expense: 0 }
    if (txn.kind === "income") {
      map.set(day, { ...prev, income: prev.income + Number(txn.amount) })
    } else if (txn.kind === "expense" || txn.kind === "tax") {
      map.set(day, { ...prev, expense: prev.expense + Number(txn.amount) })
    }
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, vals]) => ({ day, ...vals }))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-surface border border-border rounded-sm px-3 py-2 text-[10px] font-mono">
      <p className="text-on-surface/40 mb-1">Dia {label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name === "income" ? "Receita" : "Despesa"}:{" "}
          {p.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </p>
      ))}
    </div>
  )
}

export function RevenueChart({ transactions, isLoading }: RevenueChartProps) {
  if (isLoading) {
    return (
      <div className="border border-border bg-surface rounded-sm p-4 h-48 animate-pulse" />
    )
  }

  const data = groupByDay(transactions)

  if (data.length === 0) {
    return (
      <div className="border border-border bg-surface rounded-sm p-4 h-48 flex items-center justify-center">
        <span className="text-[11px] font-mono text-on-surface/20">
          Sem dados para o período
        </span>
      </div>
    )
  }

  return (
    <div className="border border-border bg-surface rounded-sm p-4">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
        FLUXO DO MÊS
      </span>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barCategoryGap="30%">
          <XAxis
            dataKey="day"
            tick={{ fontSize: 9, fontFamily: "ui-monospace", fill: "rgba(222,227,229,0.3)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="income" fill="#55D7ED" radius={[2, 2, 0, 0]} name="income" />
          <Bar dataKey="expense" fill="#FFB4AB" radius={[2, 2, 0, 0]} name="expense" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
