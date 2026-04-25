export type TaskStatus = "todo" | "doing" | "done" | "archived"
export type TaskPriority = "low" | "med" | "high" | "urgent"
export type TaskCategory = "finance" | "logistics" | "personal" | "health"
export type TxnKind = "income" | "expense" | "transfer" | "tax"
export type HealthLogKind = "weight" | "blood_pressure" | "glucose" | "heart_rate" | "temperature" | "other"

export interface Task {
  id: string
  owner_id: string
  title: string
  notes: string | null
  category: TaskCategory
  status: TaskStatus
  priority: TaskPriority
  due_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  owner_id: string
  account_id: string | null
  kind: TxnKind
  amount: number
  currency: string
  category: string | null
  description: string | null
  occurred_on: string
  created_at: string
}

export interface HealthLog {
  id: string
  owner_id: string
  kind: HealthLogKind
  value: Record<string, unknown>
  logged_at: string
}

export interface Appointment {
  id: string
  owner_id: string
  title: string
  starts_at: string
  location: string | null
  kind: string | null
  created_at: string
}

export interface FinanceSummary {
  month: string
  income: number
  expense: number
  tax: number
  balance: number
}

export interface DashboardSnapshot {
  month: string
  tasks: Record<string, number>
  finance: FinanceSummary
  upcoming_appointments: Appointment[]
  recent_health_logs: HealthLog[]
}

export interface CreateTaskInput {
  title: string
  notes?: string
  category?: TaskCategory
  priority?: TaskPriority
  due_at?: string
}

export interface UpdateTaskInput {
  title?: string
  notes?: string | null
  category?: TaskCategory
  status?: TaskStatus
  priority?: TaskPriority
  due_at?: string | null
}

export interface CreateTransactionInput {
  kind: TxnKind
  amount: number
  category?: string
  description?: string
  occurred_on: string
  account_id?: string
  currency?: string
}

export interface CreateHealthLogInput {
  kind: HealthLogKind
  value: Record<string, unknown>
  logged_at?: string
}

export interface CreateAppointmentInput {
  title: string
  starts_at: string
  location?: string
  kind?: string
}
