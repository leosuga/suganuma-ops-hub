export interface ProjectRow {
  id: string
  owner_id: string
  name: string
  description: string | null
  color: string
  status: "active" | "done" | "paused"
  created_at: string
  updated_at: string
}

export interface ProjectInsert {
  id?: string
  owner_id: string
  name: string
  description?: string | null
  color?: string
  status?: "active" | "done" | "paused"
  created_at?: string
  updated_at?: string
}

export interface ProjectUpdate {
  id?: string
  owner_id?: string
  name?: string
  description?: string | null
  color?: string
  status?: "active" | "done" | "paused"
  created_at?: string
  updated_at?: string
}
