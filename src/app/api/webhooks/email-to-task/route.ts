import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const bodySchema = z.object({
  subject: z.string().min(1),
  body: z.string().optional(),
  from: z.string().optional(),
  owner_id: z.string().uuid(),
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

// POST /api/webhooks/email-to-task
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

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("task")
    .insert({
      owner_id: parsed.owner_id,
      title: parsed.subject.slice(0, 500),
      notes: parsed.body ?? null,
      category: "personal",
      priority: "med",
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task_id: data.id }, { status: 201 })
}
