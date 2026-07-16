import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { verifyWebhookHmac, checkWebhookIdempotency, deriveEventKey } from "@/lib/webhooks/hmac"
import { logger } from "@/lib/logger"

const bodySchema = z.object({
  sha: z.string().optional(),
  status: z.enum(["success", "failure", "started"]),
  message: z.string().optional(),
  timestamp: z.string().optional(),
  run_id: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!(await verifyWebhookHmac(req, rawBody))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(JSON.parse(rawBody))
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }

  // Idempotency: use run_id if provided, otherwise hash the raw body
  const eventKey = parsed.run_id ?? (await deriveEventKey(rawBody))
  const idempotency = await checkWebhookIdempotency("deploy-status", eventKey)
  if (idempotency.replay) {
    logger.info("webhook", "deploy-status replay ignored", { eventKey })
    return NextResponse.json({ ok: true, replay: true })
  }

  const emoji = parsed.status === "success" ? "✓" : parsed.status === "failure" ? "✗" : "→"
  logger.info("deploy", `Deploy ${emoji} ${parsed.status}`, {
    sha: parsed.sha ?? "",
    message: parsed.message ?? "",
  })

  if (parsed.status === "failure" && process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
    const text = `✗ Deploy falhou — ops.suganuma.com.br\nSHA: ${parsed.sha ?? "?"}\nErro: ${parsed.message ?? "desconhecido"}\nAcesse: https://github.com/leosuga/suganuma-ops-hub/actions`
    try {
      await fetch(
        `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: process.env.TELEGRAM_CHAT_ID,
            text,
            parse_mode: "HTML",
          }),
        }
      )
    } catch {
      logger.warn("deploy", "telegram notification failed")
    }
  }

  await idempotency.mark?.()
  return NextResponse.json({ ok: true })
}