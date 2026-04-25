import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"
import { logger } from "@/lib/logger"

const rowSchema = z.object({
  kind: z.enum(["income", "expense", "transfer", "tax"]),
  amount: z.number().positive(),
  category: z.string().optional(),
  description: z.string().optional(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
})

const payloadSchema = z.object({
  owner_id: z.string().uuid(),
  rows: z.array(rowSchema).min(1).max(500),
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

// POST /api/webhooks/csv-from-bank
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!(await verifyHmac(req, rawBody))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
  }

  let parsed: z.infer<typeof payloadSchema>
  try {
    parsed = payloadSchema.parse(JSON.parse(rawBody))
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 })
  }

  const supabase = createServiceClient()
  const inserts = parsed.rows.map((row) => ({ ...row, owner_id: parsed.owner_id, currency: "BRL" }))

  const { error } = await supabase.from("transaction").insert(inserts)
  if (error) {
    logger.error("webhook", "csv-from-bank insert failed", { error: error.message })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  logger.info("webhook", "csv-from-bank imported", { count: inserts.length, owner_id: parsed.owner_id })
  return NextResponse.json({ inserted: inserts.length }, { status: 201 })
}
