"use client"

import { useMemo, useState } from "react"
import { useBudgetCategories, useUpsertBudgetCategory, useDeleteBudgetCategory } from "@/lib/queries/budget"
import { spendByCategory, categoryProgress, knownCategories } from "@/lib/finance/category"
import { fmtCurrency } from "@/lib/format"
import { cn } from "@/lib/utils"

interface TxnLike {
  kind: string
  amount: number | string
  category: string | null
}

const inputClass =
  "h-8 bg-bg border border-border rounded-sm px-2 text-[12px] font-mono text-on-surface placeholder:text-on-surface/60 focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal/50 transition-colors"

function fmt(n: number) {
  return fmtCurrency(n, { maximumFractionDigits: 0 })
}

/** Meta mensal por categoria x gasto real do mês (ex.: Bebê, Mercado). */
export function CategoryBudgets({ transactions }: { transactions: TxnLike[] }) {
  const { data: budgets = [] } = useBudgetCategories()
  const upsert = useUpsertBudgetCategory()
  const remove = useDeleteBudgetCategory()
  const [adding, setAdding] = useState(false)
  const [category, setCategory] = useState("")
  const [target, setTarget] = useState("")

  const rows = useMemo(
    () => categoryProgress(budgets, spendByCategory(transactions)),
    [budgets, transactions],
  )
  const suggestions = useMemo(() => knownCategories(transactions, budgets), [transactions, budgets])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const value = parseFloat(target.replace(",", "."))
    if (!category.trim() || !Number.isFinite(value) || value < 0) return
    await upsert.mutateAsync({ category, monthly_target: value })
    setCategory("")
    setTarget("")
    setAdding(false)
  }

  function startEdit(label: string, current: number) {
    setCategory(label)
    setTarget(String(current))
    setAdding(true)
  }

  return (
    <div className="border border-border bg-surface rounded-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/60 uppercase">
          ORÇAMENTO POR CATEGORIA
        </span>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-[8px] font-mono text-on-surface/60 hover:text-teal tracking-wider transition-colors"
          >
            + CATEGORIA
          </button>
        )}
      </div>

      {rows.length === 0 && !adding && (
        <p className="text-[10px] font-mono text-on-surface/60 text-center py-1">
          Defina uma meta por categoria (ex.: Bebê, Mercado) para acompanhar o gasto do mês.
        </p>
      )}

      {rows.map((r) => (
        <div key={r.key} className="space-y-1">
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="flex-1 text-on-surface truncate">{r.label}</span>
            <span className={cn("text-on-surface/60", r.over && "text-danger")}>
              {fmt(r.spent)} / {fmt(r.target)}
            </span>
            <button
              onClick={() => startEdit(r.label, r.target)}
              aria-label={`Editar meta de ${r.label}`}
              className="text-on-surface/60 hover:text-teal min-w-[24px]"
            >
              ✎
            </button>
            <button
              onClick={() => {
                const id = budgets.find((b) => b.category_key === r.key)?.id
                if (id) remove.mutate(id)
              }}
              aria-label={`Remover meta de ${r.label}`}
              className="text-on-surface/60 hover:text-danger min-w-[24px]"
            >
              ×
            </button>
          </div>
          <div className="h-1.5 bg-bg rounded-full overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", r.over ? "bg-danger" : r.pct > 80 ? "bg-amber" : "bg-teal")}
              style={{ width: `${Math.min(100, r.pct)}%` }}
            />
          </div>
        </div>
      ))}

      {adding && (
        <form onSubmit={handleSave} className="flex flex-wrap items-center gap-2">
          <input
            list="budget-category-suggestions"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="Categoria"
            autoFocus
            className={cn(inputClass, "flex-1 min-w-[120px]")}
          />
          <datalist id="budget-category-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <input
            inputMode="decimal"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Meta R$"
            className={cn(inputClass, "w-24")}
          />
          <button type="button" onClick={() => { setAdding(false); setCategory(""); setTarget("") }} className="h-8 px-2 text-[9px] font-mono text-on-surface/60 hover:text-on-surface/60">
            CANCELAR
          </button>
          <button type="submit" disabled={upsert.isPending} className="h-8 px-3 bg-teal/10 border border-teal text-teal font-mono text-[9px] font-semibold tracking-wider rounded-sm hover:bg-teal/20 disabled:opacity-30">
            {upsert.isPending ? "..." : "SALVAR"}
          </button>
        </form>
      )}
    </div>
  )
}
