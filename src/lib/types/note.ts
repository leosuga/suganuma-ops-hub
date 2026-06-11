export interface Attachment {
  url: string
  path: string
  name: string
  type: string
  size: number
}

export function parseAttachments(value: unknown): Attachment[] {
  if (!value || !Array.isArray(value)) return []
  return value.filter(
    (a): a is Attachment =>
      typeof a === "object" &&
      a !== null &&
      typeof (a as Record<string, unknown>).url === "string" &&
      typeof (a as Record<string, unknown>).path === "string" &&
      typeof (a as Record<string, unknown>).name === "string" &&
      typeof (a as Record<string, unknown>).type === "string" &&
      typeof (a as Record<string, unknown>).size === "number"
  )
}

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
  is_moc: boolean
  last_review: string | null
  project_id: string | null
  favorited: boolean
  attachments: unknown | null
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
  is_moc?: boolean
  last_review?: string | null
  project_id?: string | null
  favorited?: boolean
  attachments?: unknown | null
  created_at?: string
  updated_at?: string
}
