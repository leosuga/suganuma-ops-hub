import { z } from "zod"

export const noteSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1, "Título é obrigatório"),
  content: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
  linked_task_id: z.string().uuid().optional().nullable(),
  para: z.enum(["projects", "areas", "resources", "archive"]).optional().nullable(),
  daily_date: z.string().optional().nullable(),
  is_moc: z.boolean().default(false),
  last_review: z.string().optional().nullable(),
})

export type Note = z.infer<typeof noteSchema>
