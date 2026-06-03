export interface AnnualEventRow {
  id: string
  owner_id: string
  title: string
  start_date: string
  end_date: string
  start_time: string | null
  end_time: string | null
  is_all_day: boolean
  color: string
  recurrence: string
  project_id: string | null
  series_id: string | null
  project_name?: string
  location: string | null
  created_at: string
  updated_at: string
}

export interface AnnualEventInsert {
  title: string
  start_date: string
  end_date: string
  start_time?: string | null
  end_time?: string | null
  is_all_day?: boolean
  color?: string
  recurrence?: string
  project_id?: string | null
  series_id?: string | null
  location?: string | null
}

export interface AnnualEventUpdate {
  title?: string
  start_date?: string
  end_date?: string
  start_time?: string | null
  end_time?: string | null
  is_all_day?: boolean
  color?: string
  recurrence?: string
  project_id?: string | null
  series_id?: string | null
  location?: string | null
}
