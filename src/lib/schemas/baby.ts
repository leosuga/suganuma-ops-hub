import { z } from "zod"

export const babyLogKindSchema = z.enum(["feed", "diaper", "sleep", "med", "growth", "temp", "note"])

export const feedDataSchema = z.object({
  method: z.enum(["breast", "bottle"]),
  side: z.enum(["L", "R", "both"]).optional(),
  ml: z.number().positive().optional(),
  milk: z.enum(["breast_milk", "formula"]).optional(),
})

export const diaperDataSchema = z
  .object({ wet: z.boolean(), dirty: z.boolean() })
  .refine((d) => d.wet || d.dirty, { message: "Informe xixi, cocô ou os dois" })

export const medDataSchema = z.object({
  name: z.string().min(1),
  dose: z.string().optional(),
})

export const growthDataSchema = z
  .object({
    weight_g: z.number().positive().optional(),
    length_cm: z.number().positive().optional(),
    head_cm: z.number().positive().optional(),
  })
  .refine((d) => d.weight_g !== undefined || d.length_cm !== undefined || d.head_cm !== undefined, {
    message: "Informe ao menos uma medida",
  })

export const tempDataSchema = z.object({ celsius: z.number().min(30).max(45) })

// Campos de DB (owner_id, created_at) não entram no schema — ver AGENTS.md.
const logBase = {
  id: z.string().uuid().optional(),
  child_id: z.string().uuid(),
  started_at: z.string().datetime().optional(),
  ended_at: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
}

export const babyLogSchema = z.discriminatedUnion("kind", [
  z.object({ ...logBase, kind: z.literal("feed"), data: feedDataSchema }),
  z.object({ ...logBase, kind: z.literal("diaper"), data: diaperDataSchema }),
  z.object({ ...logBase, kind: z.literal("sleep"), data: z.object({}) }),
  z.object({ ...logBase, kind: z.literal("med"), data: medDataSchema }),
  z.object({ ...logBase, kind: z.literal("growth"), data: growthDataSchema }),
  z.object({ ...logBase, kind: z.literal("temp"), data: tempDataSchema }),
  z.object({ ...logBase, kind: z.literal("note"), data: z.object({}) }),
])
export type BabyLog = z.infer<typeof babyLogSchema>

export const childSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  birth_at: z.string().min(1),
  sex: z.string().optional().nullable(),
  birth_weight_g: z.number().int().positive().optional().nullable(),
  birth_length_cm: z.number().positive().optional().nullable(),
  birth_head_cm: z.number().positive().optional().nullable(),
  blood_type: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  pregnancy_id: z.string().uuid().optional().nullable(),
})
export type Child = z.infer<typeof childSchema>
