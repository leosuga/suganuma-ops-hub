import { z } from "zod"

export const habitTrackSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  active: z.boolean().default(true),
})

export const habitEntrySchema = z.object({
  id: z.string().uuid().optional(),
  habit_id: z.string().uuid(),
  done_on: z.string(),
  notes: z.string().optional().nullable(),
})

export type HabitTrack = z.infer<typeof habitTrackSchema>
export type HabitEntry = z.infer<typeof habitEntrySchema>
