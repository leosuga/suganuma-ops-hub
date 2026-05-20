"use client"

import { useState, useEffect } from "react"
import { useBudget, useUpdateBudget } from "@/lib/queries/budget"

function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

function fmt(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
}

interface BudgetCardProps {
  income: number
  expense: number
}

export function BudgetCard({ income, expense }: BudgetCardProps) {
  const month = currentMonth()
  const { data: budget } = useBudget(month)
  const updateBudget = useUpdateBudget()
  const [editing, setEditing] = useState(false)
  const [target, setTarget] = useState("")

  useEffect(() => {
    if (budget) setTarget(String(budget.target))
  }, [budget])

  const budgetTarget = budget?.target ?? 0
  const pct = budgetTarget > 0 ? Math.min(100, Math.round((expense / budgetTarget) * 100)) : 0
  const remaining = budgetTarget - expense

  async function handleSave() {
    const val = parseFloat(target.replace(",", "."))
    if (!val || val < 0) return
    await updateBudget.mutateAsync({ month, target: val, id: budget?.id })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="border border-border bg-surface rounded-sm p-3 space-y-2">
        <input
          type="text"
          inputMode="decimal"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="Orçamento (R$)"
          autoFocus
          className="w-full h-8 bg-bg border border-border rounded-sm px-3 text-[13px] font-mono text-on-surface placeholder:text-on-surface/20 focus:outline-none focus:border-teal transition-colors"
        />
        <div className="flex gap-2 justify-end">
          <button onClick={() => setEditing(false)} className="h-7 px-3 text-[9px] font-mono text-on-surface/40 hover:text-on-surface/60 transition-colors">CANCELAR</button>
          <button onClick={handleSave} disabled={updateBudget.isPending} className="h-7 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30 transition-colors">
            {updateBudget.isPending ? "..." : "SALVAR"}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border border-border bg-surface rounded-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
          ORÇAMENTO MENSAL
        </span>
        <button
          onClick={() => setEditing(true)}
          className="text-[8px] font-mono text-on-surface/30 hover:text-teal tracking-wider transition-colors"
        >
          {budget ? "EDITAR" : "DEFINIR"}
        </button>
      </div>

      {budget ? (
        <>
          <div className="flex items-end gap-2">
            <span className={`text-2xl font-mono font-bold ${pct > 100 ? "text-danger" : pct > 80 ? "text-amber" : "text-teal"}`}>
              {pct}%
            </span>
            <span className="text-[10px] font-mono text-on-surface/30 pb-1">
              {fmt(expense)} / {fmt(budgetTarget)}
            </span>
          </div>

          <div className="h-2 bg-bg rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct > 100 ? "bg-danger" : pct > 80 ? "bg-amber" : "bg-teal"}`}
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono text-on-surface/30">
              {remaining < 0 ? "Estouro:" : "Restante:"}
            </span>
            <span className={`text-[12px] font-mono font-semibold ${remaining < 0 ? "text-danger" : "text-teal"}`}>
              {fmt(Math.abs(remaining))}
            </span>
          </div>
        </>
      ) : (
        <div className="text-[10px] font-mono text-on-surface/20 text-center py-2">
          Sem orçamento definido para {month}
        </div>
      )}
    </div>
  )
}
