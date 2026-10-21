// Contas a pagar / despesas fixas — lógica pura (projeção do mês).
//
// O app registra o PASSADO das finanças (`transaction.occurred_on`); aqui mora
// o que VENCE. A despesa fixa tem um dia do mês; para cada mês projetamos o
// vencimento e cruzamos com o que já foi pago.
//
// Pagamento é por PERÍODO ('YYYY-MM'): pagar a conta de outubro não marca
// novembro como pago.

export type BillKind = "income" | "expense" | "transfer" | "tax"

export interface RecurringBill {
  id: string
  description: string
  amount: number
  kind: BillKind
  category: string | null
  account_id: string | null
  day_of_month: number
  active: boolean
}

export interface BillPayment {
  recurring_id: string
  period: string
  paid_at: string
}

export interface BillView {
  id: string
  description: string
  amount: number
  kind: BillKind
  category: string | null
  account_id: string | null
  due_on: string
  paid: boolean
  paid_at: string | null
  /** Negativo = atrasada. */
  days_until: number
}

export function periodKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`
}

function daysInMonth(year: number, month: number): number {
  // month é 1-12; dia 0 do mês seguinte = último dia do mês
  return new Date(year, month, 0).getDate()
}

/**
 * Vencimento no mês — com clamp: dia 31 em fevereiro cai no último dia
 * (28 ou 29), dia 30 em abril cai no dia 30.
 */
export function dueDateFor(year: number, month: number, dayOfMonth: number): string {
  const last = daysInMonth(year, month)
  const day = Math.min(Math.max(1, dayOfMonth), last)
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
}

export function buildBills(
  bills: RecurringBill[],
  payments: BillPayment[],
  opts: { year: number; month: number; today: string }
): BillView[] {
  const period = periodKey(opts.year, opts.month)
  const paidBy = new Map(payments.filter((p) => p.period === period).map((p) => [p.recurring_id, p]))

  const views: BillView[] = []
  for (const b of bills) {
    if (!b.active) continue
    const due = dueDateFor(opts.year, opts.month, b.day_of_month)
    const payment = paidBy.get(b.id)
    const days_until = daysBetween(opts.today, due)
    views.push({
      id: b.id,
      description: b.description,
      amount: b.amount,
      kind: b.kind,
      category: b.category,
      account_id: b.account_id,
      due_on: due,
      paid: Boolean(payment),
      paid_at: payment?.paid_at ?? null,
      days_until,
    })
  }

  // Não pagas antes do vencimento; pagas depois (vencidas primeiro).
  return views.sort((a, b) => {
    if (a.paid !== b.paid) return a.paid ? 1 : -1
    return a.due_on.localeCompare(b.due_on) || a.description.localeCompare(b.description)
  })
}

function daysBetween(fromIso: string, toIso: string): number {
  const from = Date.parse(`${fromIso}T00:00:00Z`)
  const to = Date.parse(`${toIso}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}

export interface BillsSummary {
  /** Total a pagar no mês (despesas, fixas e não pagas) */
  totalDue: number
  /** Quantas contas ainda não foram pagas */
  unpaidCount: number
  /** Quantas estão vencidas */
  overdueCount: number
  /** Quantas vencem hoje ou amanhã */
  dueSoonCount: number
  /** Já pago no mês */
  totalPaid: number
}

export function billsSummary(bills: BillView[]): BillsSummary {
  let totalDue = 0
  let totalPaid = 0
  let unpaidCount = 0
  let overdueCount = 0
  let dueSoonCount = 0
  for (const b of bills) {
    if (b.kind !== "expense") continue
    if (b.paid) {
      totalPaid += b.amount
      continue
    }
    totalDue += b.amount
    unpaidCount++
    if (b.days_until < 0) overdueCount++
    else if (b.days_until <= 1) dueSoonCount++
  }
  return { totalDue, totalPaid, unpaidCount, overdueCount, dueSoonCount }
}
