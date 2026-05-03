import { z } from "zod"

export const noteSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Título é obrigatório"),
  content: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
})

export type Note = z.infer<typeof noteSchema>
