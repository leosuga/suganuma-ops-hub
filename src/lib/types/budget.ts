export interface BudgetRow {
  id: string
  owner_id: string
  month: string
  target: number
  created_at: string
  updated_at: string
}

export interface BudgetCategoryRow {
  id: string
  owner_id: string
  category: string
  category_key: string
  monthly_target: number
  created_at: string
  updated_at: string
}
