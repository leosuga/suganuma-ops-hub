import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"
import { verifyWebhookHmac, checkWebhookIdempotency, deriveEventKey, resolveWebhookOwnerId } from "@/lib/webhooks/hmac"
import { logger } from "@/lib/logger"

const bodySchema = z.object({
  subject: z.string().min(1),
  body: z.string().optional(),
  from: z.string().optional(),
  message_id: z.string().optional(),
})

// POST /api/webhooks/email-to-task
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!(await verifyWebhookHmac(req, rawBody, process.env.EMAIL_SECRET || process.env.WEBHOOK_SECRET))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
  }

  const ownerId = resolveWebhookOwnerId()
  if (!ownerId) {
    logger.error("webhook", "WEBHOOK_OWNER_ID não configurado", {})
    return NextResponse.json({ error: "Servidor não configurado" }, { status: 500 })
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(JSON.parse(rawBody))
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }

  // Idempotency: use message_id if provided, otherwise hash the raw body
  const eventKey = parsed.message_id ?? (await deriveEventKey(rawBody))
  const idempotency = await checkWebhookIdempotency("email-to-task", eventKey)
  if (idempotency.replay) {
    logger.info("webhook", "email-to-task replay ignored", { eventKey })
    return NextResponse.json({ ok: true, replay: true })
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("task")
    .insert({
      owner_id: ownerId,
      title: parsed.subject.slice(0, 500),
      notes: parsed.body ?? null,
      category: "personal",
      priority: "med",
    })
    .select("id")
    .single()

  if (error) {
    logger.error("webhook", "email-to-task insert failed", { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await idempotency.mark?.()
  logger.info("webhook", "email-to-task created", { task_id: data.id, from: parsed.from ?? "" })
  return NextResponse.json({ task_id: data.id }, { status: 201 })
}