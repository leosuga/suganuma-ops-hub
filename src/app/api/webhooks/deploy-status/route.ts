import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { logger } from "@/lib/logger"

const bodySchema = z.object({
  sha: z.string().optional(),
  status: z.enum(["success", "failure", "started"]),
  message: z.string().optional(),
  timestamp: z.string().optional(),
})

async function verifyHmac(req: NextRequest, rawBody: string): Promise<boolean> {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return false

  const sig = req.headers.get("x-hub-signature-256") ?? ""
  if (!sig.startsWith("sha256=")) return false

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody))
  const expected = "sha256=" + Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("")

  return sig === expected
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!(await verifyHmac(req, rawBody))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
  }

  let parsed: z.infer<typeof bodySchema>
  try {
    parsed = bodySchema.parse(JSON.parse(rawBody))
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
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

  return NextResponse.json({ ok: true })
}
