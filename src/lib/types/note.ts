export interface NoteRow {
  id: string
  owner_id: string
  title: string
  content: string | null
  tags: string[] | null
  pinned: boolean
  linked_task_id: string | null
  para: "projects" | "areas" | "resources" | "archive" | null
  daily_date: string | null
  created_at: string
  updated_at: string
}

export interface NoteInsert {
  id?: string
  owner_id: string
  title: string
  content?: string | null
  tags?: string[] | null
  pinned?: boolean
  linked_task_id?: string | null
  para?: "projects" | "areas" | "resources" | "archive" | null
  daily_date?: string | null
  created_at?: string
  updated_at?: string
}
