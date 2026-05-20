export interface MealRow {
  id: string
  owner_id: string
  name: string
  kind: string
  tags: string[] | null
  ingredients: string[] | null
  prep_time: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface MealPlanRow {
  id: string
  owner_id: string
  meal_id: string | null
  date: string
  meal_type: string
  notes: string | null
  created_at: string
}
