// Task Zod schema - TODO
import { z } from "zod"

export const taskSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1),
  notes: z.string().optional(),
  category: z.enum(["finance", "logistics", "personal", "health"]).default("personal"),
  status: z.enum(["todo", "doing", "done", "archived"]).default("todo"),
  priority: z.enum(["low", "med", "high", "urgent"]).default("med"),
  due_at: z.string().datetime().optional().nullable(),
})

export type Task = z.infer<typeof taskSchema>
