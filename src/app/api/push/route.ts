import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPublicKey, isWebPushConfigured } from "@/lib/web-push"

// GET /api/push — chave pública VAPID (necessária para subscribe no client)
export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web Push não configurado" }, { status: 501 })
  }
  return NextResponse.json({ publicKey: getPublicKey() })
}

// POST /api/push — registra a subscription do dispositivo atual
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as {
    endpoint?: unknown
    keys?: { p256dh?: unknown; auth?: unknown }
  } | null

  if (
    !body ||
    typeof body.endpoint !== "string" ||
    !body.keys ||
    typeof body.keys.p256dh !== "string" ||
    typeof body.keys.auth !== "string"
  ) {
    return NextResponse.json({ error: "subscription inválida" }, { status: 400 })
  }

  // Upsert por endpoint (mesmo dispositivo re-subscribe = atualiza chaves).
  // RLS: owner_id = auth.uid() garantido pela policy da tabela.
  const { error } = await supabase.from("push_subscription").upsert(
    {
      owner_id: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    },
    { onConflict: "endpoint" },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/push — remove a subscription (unsubscribe)
export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null
  if (!body || typeof body.endpoint !== "string") {
    return NextResponse.json({ error: "endpoint obrigatório" }, { status: 400 })
  }

  const { error } = await supabase
    .from("push_subscription")
    .delete()
    .eq("endpoint", body.endpoint)
    .eq("owner_id", user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}