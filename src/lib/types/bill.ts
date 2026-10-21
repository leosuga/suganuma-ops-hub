export type BillKind = "income" | "expense" | "transfer" | "tax"

export interface RecurringBillRow {
  id: string
  owner_id: string
  description: string
  amount: number
  kind: BillKind
  category: string | null
  account_id: string | null
  day_of_month: number
  active: boolean
  created_at: string
}

export interface BillPaymentRow {
  id: string
  owner_id: string
  recurring_id: string
  period: string
  paid_at: string
}

export interface RecurringBillInsert {
  description: string
  amount: number
  kind?: BillKind
  category?: string | null
  account_id?: string | null
  day_of_month?: number
  active?: boolean
}
