import { z } from "zod"

export const healthLogKindSchema = z.enum(["weight", "blood_pressure", "glucose", "temperature", "heart_rate", "other"])
export type HealthLogKind = z.infer<typeof healthLogKindSchema>

const weightValueSchema = z.object({ kg: z.number().positive() })
const bloodPressureValueSchema = z.object({
  systolic: z.number().int().positive(),
  diastolic: z.number().int().positive(),
  pulse: z.number().int().positive().optional(),
})
const glucoseValueSchema = z.object({ mg_dl: z.number().positive(), fasting: z.boolean() })
const temperatureValueSchema = z.object({ celsius: z.number() })
const heartRateValueSchema = z.object({ bpm: z.number().int().positive() })
const otherValueSchema = z.record(z.string(), z.unknown())

export const healthLogValueSchema = z.union([
  weightValueSchema,
  bloodPressureValueSchema,
  glucoseValueSchema,
  temperatureValueSchema,
  heartRateValueSchema,
  otherValueSchema,
])

export const healthLogSchema = z.object({
  id: z.string().uuid().optional(),
  kind: healthLogKindSchema,
  value: healthLogValueSchema,
  logged_at: z.string().optional(),
})
export type HealthLog = z.infer<typeof healthLogSchema>

export const pregnancySchema = z.object({
  id: z.string().uuid().optional(),
  due_date: z.string().optional().nullable(),
  week: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
})
export type Pregnancy = z.infer<typeof pregnancySchema>

export const appointmentSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  starts_at: z.string(),
  location: z.string().optional().nullable(),
  kind: z.string().optional().nullable(),
})
export type Appointment = z.infer<typeof appointmentSchema>

export const protocolSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  schedule: z.record(z.string(), z.unknown()).optional().nullable(),
  active: z.boolean().default(true),
})
export type Protocol = z.infer<typeof protocolSchema>

export const protocolEntrySchema = z.object({
  id: z.string().uuid().optional(),
  protocol_id: z.string().uuid(),
  done_on: z.string(),
  notes: z.string().optional().nullable(),
})
export type ProtocolEntry = z.infer<typeof protocolEntrySchema>
