export interface HabitTrackRow {
  id: string
  owner_id: string
  name: string
  active: boolean
  created_at: string
}

export interface HabitEntryRow {
  id: string
  habit_id: string
  done_on: string
  notes: string | null
  created_at: string
}
