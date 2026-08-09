export interface InboxItemRow {
  id: string
  owner_id: string
  content: string
  source: string
  ai_payload: Record<string, unknown> | null
  status: string
  created_at: string
  triaged_at: string | null
}

export interface InboxItemInsert {
  content: string
  source?: string
  ai_payload?: Record<string, unknown> | null
}