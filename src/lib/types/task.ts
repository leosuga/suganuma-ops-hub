export interface TaskRow {
  id: string
  owner_id: string
  title: string
  notes: string | null
  category: "finance" | "logistics" | "personal" | "health"
  status: "todo" | "doing" | "done" | "archived"
  priority: "low" | "med" | "high" | "urgent"
  due_at: string | null
  completed_at: string | null
  project_id: string | null
  delegated_to: string | null
  important: boolean
  recurrence: string | null
  created_at: string
  updated_at: string
}

export interface TaskInsert {
  id?: string
  owner_id: string
  title: string
  notes?: string | null
  category?: "finance" | "logistics" | "personal" | "health"
  status?: "todo" | "doing" | "done" | "archived"
  priority?: "low" | "med" | "high" | "urgent"
  due_at?: string | null
  completed_at?: string | null
  project_id?: string | null
  delegated_to?: string | null
  important?: boolean
  recurrence?: string | null
  created_at?: string
  updated_at?: string
}

export interface TaskUpdate {
  id?: string
  owner_id?: string
  title?: string
  notes?: string | null
  category?: "finance" | "logistics" | "personal" | "health"
  status?: "todo" | "doing" | "done" | "archived"
  priority?: "low" | "med" | "high" | "urgent"
  due_at?: string | null
  completed_at?: string | null
  project_id?: string | null
  delegated_to?: string | null
  important?: boolean
  recurrence?: string | null
  created_at?: string
  updated_at?: string
}
