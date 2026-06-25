type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

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

// ---------- Runtime validators for JSON columns ----------

export interface WeightValue {
  kg: number
}

export interface BloodPressureValue {
  systolic: number
  diastolic: number
}

export interface GlucoseValue {
  mgdl: number
  fasting?: boolean
}

/**
 * Safely parse a health_log.value JSON column as a weight value.
 * Returns null if the shape doesn't match.
 */
export function parseWeightValue(value: unknown): WeightValue | null {
  if (typeof value !== "object" || value === null) return null
  const obj = value as Record<string, unknown>
  if (typeof obj.kg === "number") return { kg: obj.kg }
  return null
}

/**
 * Safely parse a health_log.value JSON column as a blood pressure value.
 * Returns null if the shape doesn't match.
 */
export function parseBloodPressureValue(value: unknown): BloodPressureValue | null {
  if (typeof value !== "object" || value === null) return null
  const obj = value as Record<string, unknown>
  if (typeof obj.systolic === "number" && typeof obj.diastolic === "number") {
    return { systolic: obj.systolic, diastolic: obj.diastolic }
  }
  return null
}

/**
 * Safely parse a health_log.value JSON column as a glucose value.
 * Returns null if the shape doesn't match.
 */
export function parseGlucoseValue(value: unknown): GlucoseValue | null {
  if (typeof value !== "object" || value === null) return null
  const obj = value as Record<string, unknown>
  if (typeof obj.mgdl === "number") {
    return { mgdl: obj.mgdl, fasting: typeof obj.fasting === "boolean" ? obj.fasting : undefined }
  }
  return null
}

/**
 * Generic safe parser for health_log.value — returns the value as a
 * Record<string, unknown> if it's an object, or null otherwise.
 */
export function parseHealthLogValue(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null
  return value as Record<string, unknown>
}
