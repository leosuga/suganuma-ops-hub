export interface AnnualEventRow {
  id: string
  owner_id: string
  title: string
  start_date: string
  end_date: string
  color: string
  recurrence: string
  created_at: string
  updated_at: string
}

export interface AnnualEventInsert {
  title: string
  start_date: string
  end_date: string
  color?: string
  recurrence?: string
}

export interface AnnualEventUpdate {
  title?: string
  start_date?: string
  end_date?: string
  color?: string
  recurrence?: string
}
