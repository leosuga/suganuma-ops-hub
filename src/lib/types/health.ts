import type { Json } from "@/lib/database.types"

export interface HealthLogRow {
  id: string
  owner_id: string
  kind: string
  value: Json
  logged_at: string
}

export interface PregnancyRow {
  id: string
  owner_id: string
  due_date: string | null
  week: number | null
  notes: string | null
  created_at: string
}

export interface AppointmentRow {
  id: string
  owner_id: string
  title: string
  starts_at: string
  location: string | null
  kind: string | null
  created_at: string
}

export interface ProtocolRow {
  id: string
  owner_id: string
  name: string
  schedule: Json | null
  active: boolean
  created_at: string
}

export interface ProtocolEntryRow {
  id: string
  protocol_id: string
  done_on: string
  notes: string | null
  created_at: string
}
