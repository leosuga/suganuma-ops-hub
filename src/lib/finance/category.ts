// Orçamento por categoria. `transaction.category` é texto livre, então "Bebê",
// "bebe" e " BEBÊ " precisam cair no mesmo balde.

export function normalizeCategory(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

interface TxnLike {
  kind: string
  amount: number | string
  category: string | null
}

export interface CategorySpend {
  label: string
  total: number
}

/** Gasto do mês por categoria. Soma `expense` e `tax`, igual à barra global do BudgetCard. */
export function spendByCategory(txns: TxnLike[]): Map<string, CategorySpend> {
  const out = new Map<string, CategorySpend>()
  for (const t of txns) {
    if (t.kind !== "expense" && t.kind !== "tax") continue
    const label = (t.category ?? "").trim()
    if (!label) continue
    const key = normalizeCategory(label)
    const cur = out.get(key)
    if (cur) cur.total += Number(t.amount)
    else out.set(key, { label, total: Number(t.amount) })
  }
  return out
}

export interface CategoryProgress {
  key: string
  label: string
  spent: number
  target: number
  pct: number
  over: boolean
}

export function categoryProgress(
  budgets: Array<{ category: string; monthly_target: number }>,
  spend: Map<string, CategorySpend>,
): CategoryProgress[] {
  return budgets.map((b) => {
    const key = normalizeCategory(b.category)
    const spent = spend.get(key)?.total ?? 0
    const target = Number(b.monthly_target)
    return {
      key,
      label: b.category,
      spent,
      target,
      pct: target > 0 ? Math.round((spent / target) * 100) : 0,
      over: target > 0 && spent > target,
    }
  })
}

/** Categorias conhecidas (de transações e orçamentos) para sugerir no formulário, sem duplicar por caixa. */
export function knownCategories(
  txns: Array<{ category: string | null }>,
  budgets: Array<{ category: string }>,
): string[] {
  const seen = new Map<string, string>()
  for (const label of [...budgets.map((b) => b.category), ...txns.map((t) => t.category ?? "")]) {
    const trimmed = label.trim()
    if (!trimmed) continue
    const key = normalizeCategory(trimmed)
    if (!seen.has(key)) seen.set(key, trimmed)
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b, "pt-BR"))
}
