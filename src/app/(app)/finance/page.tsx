"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { useAccounts, useTransactions, useDeleteTransaction, useCreateTransaction } from "@/lib/queries/finance"
import { FinanceKPIs } from "@/components/finance/FinanceKPIs"
import { TransactionTable } from "@/components/finance/TransactionTable"
import { AccountManager } from "@/components/finance/AccountManager"
import { AddTransactionDialog } from "@/components/finance/AddTransactionDialog"
import { EditTransactionDialog } from "@/components/finance/EditTransactionDialog"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { useUndoToast } from "@/components/UndoToast"
import type { TransactionRow } from "@/lib/queries/finance"

const RevenueChart = dynamic(() => import("@/components/finance/RevenueChart").then(m => ({ default: m.RevenueChart })), { ssr: false })
const CSVImportDialog = dynamic(() => import("@/components/finance/CSVImportDialog").then(m => ({ default: m.CSVImportDialog })), { ssr: false })

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export default function FinancePage() {
  const [addOpen, setAddOpen] = useState(false)
  const [csvOpen, setCsvOpen] = useState(false)
  const [editingTxn, setEditingTxn] = useState<TransactionRow | null>(null)
  const [month, setMonth] = useState(currentMonth())
  const [kindFilter, setKindFilter] = useState<string>("")

  const { data: accounts = [] } = useAccounts()
  const { data: transactions = [], isLoading } = useTransactions({ month, kind: kindFilter || undefined })
  const deleteTransaction = useDeleteTransaction()
  const createTransaction = useCreateTransaction()
  const toast = useUndoToast()

  const monthLabel = new Date(month + "-15").toLocaleDateString("pt-BR", { month: "long", year: "numeric" })

  function prevMonth() {
    const [y, m] = month.split("-").map(Number)
    const d = new Date(y, m - 2, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  function nextMonth() {
    const [y, m] = month.split("-").map(Number)
    const d = new Date(y, m, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  function handleDelete(id: string) {
    const txn = transactions.find((t) => t.id === id)
    if (!txn) return
    const snap = { ...txn }
    deleteTransaction.mutate(id, {
      onSuccess: () => {
        toast.show({
          label: `Transação excluída`,
          onUndo: () => {
            createTransaction.mutate({
              kind: snap.kind,
              amount: Number(snap.amount),
              currency: snap.currency,
              description: snap.description ?? undefined,
              category: snap.category ?? undefined,
              occurred_on: snap.occurred_on,
              account_id: snap.account_id ?? undefined,
            })
          },
        })
      },
    })
  }

  return (
    <SectionErrorBoundary label="FINANCE HUB">
    <div className="p-4 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">FINANCE HUB</h1>
          <p className="text-[10px] font-mono text-on-surface/30 mt-0.5 capitalize">{monthLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCsvOpen(true)} className="h-7 px-3 text-[9px] font-mono font-semibold tracking-wider border border-border text-on-surface/40 hover:border-on-surface/40 hover:text-on-surface/70 rounded-sm transition-colors">IMPORTAR CSV</button>
          <button onClick={() => setAddOpen(true)} className="h-7 px-3 text-[9px] font-mono font-semibold tracking-wider border border-teal text-teal hover:bg-teal/10 rounded-sm transition-colors">+ NOVA TRANSAÇÃO</button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={prevMonth} className="w-6 h-6 flex items-center justify-center text-on-surface/30 hover:text-on-surface/70 font-mono transition-colors">‹</button>
        <span className="text-[11px] font-mono text-on-surface/60 capitalize min-w-30 text-center">{monthLabel}</span>
        <button onClick={nextMonth} className="w-6 h-6 flex items-center justify-center text-on-surface/30 hover:text-on-surface/70 font-mono transition-colors">›</button>
      </div>

      <FinanceKPIs transactions={transactions} isLoading={isLoading} />
      <RevenueChart transactions={transactions} isLoading={isLoading} />

      <div className="flex items-center gap-2">
        <span className="text-[9px] font-mono text-on-surface/30 uppercase tracking-widest">FILTRAR:</span>
        {[{ value: "", label: "TODOS" }, { value: "income", label: "RECEITA" }, { value: "expense", label: "DESPESA" }, { value: "transfer", label: "TRANSF." }, { value: "tax", label: "IMPOSTO" }].map((opt) => (
          <button key={opt.value} onClick={() => setKindFilter(opt.value)} className={`h-6 px-2 text-[8px] font-mono font-semibold tracking-wider rounded-sm border transition-colors ${kindFilter === opt.value ? "border-teal bg-teal/10 text-teal" : "border-border text-on-surface/30 hover:border-on-surface/40"}`}>{opt.label}</button>
        ))}
      </div>

      <TransactionTable transactions={transactions} isLoading={isLoading} onDelete={handleDelete} onEdit={(txn) => setEditingTxn(txn)} />
      <AccountManager />

      <AddTransactionDialog open={addOpen} onOpenChange={setAddOpen} accounts={accounts} />
      <CSVImportDialog open={csvOpen} onOpenChange={setCsvOpen} />
      <EditTransactionDialog open={!!editingTxn} onOpenChange={(v) => { if (!v) setEditingTxn(null) }} transaction={editingTxn} accounts={accounts} />
    </div>
    </SectionErrorBoundary>
  )
}
