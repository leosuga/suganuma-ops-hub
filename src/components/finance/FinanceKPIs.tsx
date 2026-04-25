"use client"

import type { TransactionRow } from "@/lib/queries/finance"

interface FinanceKPIsProps {
  transactions: TransactionRow[]
  isLoading: boolean
}

function KPICard({
  label,
  value,
  color = "text-on-surface",
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="border border-border bg-surface rounded-sm p-4 flex flex-col gap-1">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
        {label}
      </span>
      <span className={`text-[22px] font-mono font-bold leading-none ${color}`}>
        {value}
      </span>
    </div>
  )
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
}

export function FinanceKPIs({ transactions, isLoading }: FinanceKPIsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="border border-border bg-surface rounded-sm p-4 h-20 animate-pulse" />
        ))}
      </div>
    )
  }

  const income = transactions
    .filter((t) => t.kind === "income")
    .reduce((s, t) => s + Number(t.amount), 0)

  const expense = transactions
    .filter((t) => t.kind === "expense" || t.kind === "tax")
    .reduce((s, t) => s + Number(t.amount), 0)

  const net = income - expense

  const transfers = transactions.filter((t) => t.kind === "transfer").length

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <KPICard label="Receita" value={fmt(income)} color="text-teal" />
      <KPICard
        label="Despesa"
        value={fmt(expense)}
        color={expense > 0 ? "text-danger" : "text-on-surface"}
      />
      <KPICard
        label="Saldo"
        value={fmt(net)}
        color={net >= 0 ? "text-teal" : "text-danger"}
      />
      <KPICard
        label="Transferências"
        value={String(transfers)}
        color="text-amber"
      />
    </div>
  )
}
