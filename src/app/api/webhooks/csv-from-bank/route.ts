import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"
import { verifyWebhookHmac, checkWebhookIdempotency, deriveEventKey, resolveWebhookOwnerId } from "@/lib/webhooks/hmac"
import { logger } from "@/lib/logger"

const rowSchema = z.object({
  kind: z.enum(["income", "expense", "transfer", "tax"]),
  amount: z.number().positive(),
  category: z.string().optional(),
  description: z.string().optional(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const payloadSchema = z.object({
  rows: z.array(rowSchema).min(1).max(500),
  import_id: z.string().optional(),
})

// POST /api/webhooks/csv-from-bank
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!(await verifyWebhookHmac(req, rawBody))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
  }

  const ownerId = resolveWebhookOwnerId()
  if (!ownerId) {
    logger.error("webhook", "WEBHOOK_OWNER_ID não configurado", {})
    return NextResponse.json({ error: "Servidor não configurado" }, { status: 500 })
  }

  let parsed: z.infer<typeof payloadSchema>
  try {
    parsed = payloadSchema.parse(JSON.parse(rawBody))
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }

  // Idempotency: use import_id if provided, otherwise hash the raw body
  const eventKey = parsed.import_id ?? (await deriveEventKey(rawBody))
  const idempotency = await checkWebhookIdempotency("csv-from-bank", eventKey)
  if (idempotency.replay) {
    logger.info("webhook", "csv-from-bank replay ignored", { eventKey })
    return NextResponse.json({ ok: true, replay: true })
  }

  const supabase = createServiceClient()
  const inserts = parsed.rows.map((row) => ({ ...row, owner_id: ownerId, currency: "BRL" }))

  const { error } = await supabase.from("transaction").insert(inserts)
  if (error) {
    logger.error("webhook", "csv-from-bank insert failed", { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await idempotency.mark?.()
  logger.info("webhook", "csv-from-bank imported", { count: inserts.length })
  return NextResponse.json({ inserted: inserts.length }, { status: 201 })
}