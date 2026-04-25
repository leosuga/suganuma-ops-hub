"use client"

import { cn } from "@/lib/utils"
import type { TransactionRow } from "@/lib/queries/finance"
import type { TxnKind } from "@/lib/schemas/finance"

const KIND_COLORS: Record<TxnKind, string> = {
  income: "text-teal",
  expense: "text-danger",
  transfer: "text-amber",
  tax: "text-on-surface/40",
}

const KIND_LABELS: Record<TxnKind, string> = {
  income: "REC",
  expense: "DES",
  transfer: "TRF",
  tax: "IMP",
}

interface TransactionTableProps {
  transactions: TransactionRow[]
  isLoading: boolean
  onDelete?: (id: string) => void
}

function fmt(n: number, kind: TxnKind) {
  const sign = kind === "income" ? "+" : kind === "transfer" ? "" : "-"
  return sign + n.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
}

export function TransactionTable({ transactions, isLoading, onDelete }: TransactionTableProps) {
  if (isLoading) {
    return (
      <div className="border border-border bg-surface rounded-sm">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 border-b border-border animate-pulse" />
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="border border-border bg-surface rounded-sm p-8 flex items-center justify-center">
        <span className="text-[11px] font-mono text-on-surface/30">
          Nenhuma transação neste período
        </span>
      </div>
    )
  }

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      {/* Header */}
      <div className="h-8 px-4 flex items-center gap-3 border-b border-border bg-bg">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase w-8">
          TIPO
        </span>
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase flex-1">
          DESCRIÇÃO / CATEGORIA
        </span>
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase w-20 text-right">
          DATA
        </span>
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/30 uppercase w-24 text-right">
          VALOR
        </span>
        {onDelete && <span className="w-6" />}
      </div>

      <div className="divide-y divide-border">
        {transactions.map((txn) => {
          const dateStr = new Date(txn.occurred_on + "T12:00:00").toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          })

          return (
            <div
              key={txn.id}
              className="flex items-center gap-3 h-10 px-4 hover:bg-surface-hover transition-colors"
            >
              <span
                className={cn(
                  "flex-none w-8 text-[8px] font-mono font-semibold tracking-wider",
                  KIND_COLORS[txn.kind]
                )}
              >
                {KIND_LABELS[txn.kind]}
              </span>

              <div className="flex-1 min-w-0">
                <span className="text-[12px] font-mono text-on-surface truncate block">
                  {txn.description || txn.category || "—"}
                </span>
                {txn.category && txn.description && (
                  <span className="text-[10px] font-mono text-on-surface/30 truncate block leading-none">
                    {txn.category}
                  </span>
                )}
              </div>

              <span className="flex-none w-20 text-right text-[10px] font-mono text-on-surface/40">
                {dateStr}
              </span>

              <span
                className={cn(
                  "flex-none w-24 text-right text-[12px] font-mono font-semibold tabular-nums",
                  KIND_COLORS[txn.kind]
                )}
              >
                {fmt(Number(txn.amount), txn.kind)}
              </span>

              {onDelete && (
                <button
                  onClick={() => onDelete(txn.id)}
                  className="flex-none w-6 h-6 flex items-center justify-center text-on-surface/20 hover:text-danger transition-colors rounded-sm"
                  aria-label="Excluir transação"
                >
                  ×
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
