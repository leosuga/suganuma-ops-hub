export type BabyLogKind = "feed" | "diaper" | "sleep" | "med" | "growth" | "temp" | "note"

export interface ChildRow {
  id: string
  owner_id: string
  name: string
  birth_at: string
  sex: string | null
  birth_weight_g: number | null
  birth_length_cm: number | null
  birth_head_cm: number | null
  blood_type: string | null
  notes: string | null
  project_id: string | null
  pregnancy_id: string | null
  created_at: string
  updated_at: string
}

export interface BabyLogRow {
  id: string
  owner_id: string
  child_id: string
  kind: BabyLogKind
  started_at: string
  ended_at: string | null
  data: Record<string, unknown>
  notes: string | null
  created_at: string
}
