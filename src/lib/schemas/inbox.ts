import { z } from "zod"

export const inboxItemSchema = z.object({
  content: z.string().min(1).max(5000),
  source: z.enum(["manual", "telegram", "audio", "email", "webhook", "mcp"]).default("manual"),
  ai_payload: z.record(z.string(), z.unknown()).optional().nullable(),
})

export type InboxItem = z.infer<typeof inboxItemSchema>