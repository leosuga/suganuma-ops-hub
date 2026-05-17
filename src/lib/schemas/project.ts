import { z } from "zod"

export const projectSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional().nullable(),
  color: z.string().default("#55D7ED"),
  status: z.enum(["active", "done", "paused"]).default("active"),
})

export type Project = z.infer<typeof projectSchema>
