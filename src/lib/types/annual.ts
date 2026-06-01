export interface AnnualEventRow {
  id: string
  owner_id: string
  title: string
  start_date: string
  end_date: string
  color: string
  recurrence: string
  project_id: string | null
  series_id: string | null
  project_name?: string  // joined from project table
  created_at: string
  updated_at: string
}

export interface AnnualEventInsert {
  title: string
  start_date: string
  end_date: string
  color?: string
  recurrence?: string
  project_id?: string | null
  series_id?: string | null
}

export interface AnnualEventUpdate {
  title?: string
  start_date?: string
  end_date?: string
  color?: string
  recurrence?: string
  project_id?: string | null
  series_id?: string | null
}
