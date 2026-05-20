export interface TransactionRow {
  id: string
  owner_id: string
  account_id: string | null
  kind: "income" | "expense" | "transfer" | "tax"
  amount: number
  currency: string
  category: string | null
  description: string | null
  occurred_on: string
  created_at: string
}

export interface TransactionInsert {
  id?: string
  owner_id: string
  account_id?: string | null
  kind: "income" | "expense" | "transfer" | "tax"
  amount: number
  currency?: string
  category?: string | null
  description?: string | null
  occurred_on: string
  created_at?: string
}

export interface AccountRow {
  id: string
  owner_id: string
  name: string
  kind: string | null
  currency: string
  opening_balance: number
  created_at: string
}

export interface AccountInsert {
  id?: string
  owner_id: string
  name: string
  kind?: string | null
  currency?: string
  opening_balance?: number
  created_at?: string
}
