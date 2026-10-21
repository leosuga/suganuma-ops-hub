"use client"

import { useMemo, useState } from "react"
import { useRecurringBills, useBillPayments, useMarkBillPaid } from "@/lib/queries/bills"
import { buildBills, billsSummary, periodKey, type BillView } from "@/lib/bills"
import { dateStr } from "@/lib/date"
import { fmtCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"
import { AddBillDialog } from "./AddBillDialog"

interface BillsCardProps {
  /** Ano e mês da visão (o Finance navega por mês). */
  year: number
  month: number
  /** Rótulo do card; o Dashboard usa "A VENCER". */
  title?: string
  /** Esconde a lista (usa só o total) — para o widget do Dashboard. */
  summaryOnly?: boolean
}

/**
 * Contas do mês: as despesas fixas projetadas para o mês, com o que já foi
 * pago. O que VENCE morava fora do app — a `transaction` só registra o
 * passado.
 */
export function BillsCard({ year, month, title = "CONTAS DO MÊS", summaryOnly = false }: BillsCardProps) {
  const period = periodKey(year, month)
  const { data: bills = [] } = useRecurringBills()
  const { data: payments = [] } = useBillPayments(period)
  const markPaid = useMarkBillPaid()
  const [addOpen, setAddOpen] = useState(false)

  const views = useMemo(
    () => buildBills(bills, payments, { year, month, today: dateStr(new Date()) }),
    [bills, payments, year, month]
  )
  const summary = useMemo(() => billsSummary(views), [views])

  function toggle(bill: BillView) {
    markPaid.mutate({ recurring_id: bill.id, period, paid: !bill.paid })
  }

  if (summaryOnly) {
    if (summary.unpaidCount === 0) return null
    return (
      <div className="border border-border bg-surface rounded-sm px-4 py-3 flex items-center justify-between">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase">
          A VENCER
        </span>
        <span className="text-[11px] font-mono font-semibold text-amber tabular-nums">
          {summary.unpaidCount} · {fmtCurrency(summary.totalDue, { maximumFractionDigits: 0 })}
        </span>
      </div>
    )
  }

  return (
    <div className="border border-border bg-surface rounded-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase">
          {title}
        </span>
        <div className="flex items-center gap-3">
          {summary.overdueCount > 0 && (
            <span className="text-[9px] font-mono text-danger">
              {summary.overdueCount} VENCIDA{summary.overdueCount > 1 ? "S" : ""}
            </span>
          )}
          <span className="text-[11px] font-mono font-semibold text-teal tabular-nums">
            {fmtCurrency(summary.totalDue, { maximumFractionDigits: 0 })}
          </span>
        </div>
      </div>

      {views.length === 0 ? (
        <div className="px-4 py-4 text-[10px] font-mono text-on-surface/60">
          Nenhuma conta fixa cadastrada.
        </div>
      ) : (
        <div className="divide-y divide-border">
          {views.map((bill) => (
            <div key={bill.id} className="px-4 py-2 flex items-center gap-3">
              <button
                onClick={() => toggle(bill)}
                aria-label={bill.paid ? `Marcar ${bill.description} como pendente` : `Marcar ${bill.description} como paga`}
                aria-pressed={bill.paid}
                className={cn(
                  "flex-none w-7 h-7 rounded-sm border flex items-center justify-center transition-colors",
                  bill.paid
                    ? "border-teal bg-teal/20 text-teal"
                    : "border-border text-on-surface/40 hover:border-teal/60 hover:text-teal"
                )}
              >
                {bill.paid && (
                  <svg width="10" height="10" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                    <path d="M1 4L3 6L7 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span
                className={cn(
                  "flex-1 text-[11px] font-mono truncate",
                  bill.paid ? "text-on-surface/60 line-through" : "text-on-surface"
                )}
              >
                {bill.description}
              </span>
              <span
                className={cn(
                  "flex-none text-[9px] font-mono",
                  bill.paid
                    ? "text-on-surface/60"
                    : bill.days_until < 0
                      ? "text-danger"
                      : bill.days_until <= 1
                        ? "text-amber"
                        : "text-on-surface/60"
                )}
              >
                {bill.due_on.slice(8, 10)}/{bill.due_on.slice(5, 7)}
              </span>
              <span className="flex-none text-[11px] font-mono tabular-nums text-on-surface/60 w-20 text-right">
                {fmtCurrency(bill.amount, { maximumFractionDigits: 0 })}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-2 border-t border-border flex items-center justify-between">
        <span className="text-[9px] font-mono text-on-surface/60">
          {summary.unpaidCount > 0
            ? `${summary.unpaidCount} A PAGAR · ${fmtCurrency(summary.totalPaid, { maximumFractionDigits: 0 })} PAGO`
            : "TUDO PAGO"}
        </span>
        <button
          onClick={() => setAddOpen(true)}
          className="h-7 px-2.5 border border-teal/40 bg-teal/10 text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 transition-colors"
        >
          + DESPESA FIXA
        </button>
      </div>

      <AddBillDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  )
}
