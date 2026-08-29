import { NextRequest, NextResponse } from "next/server"
import { verifyWebhookHmac, resolveWebhookOwnerId } from "@/lib/webhooks/hmac"
import { sendPushToOwner, isWebPushConfigured } from "@/lib/web-push"
import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logger"

// POST /api/push/send
//
// Envia o briefing diário via Web Push para todas as subscriptions do dono.
// Acionado por: GH Actions cron (matinal), MCP, ou curl manual. HMAC auth.
//
// Payload opcional: { "title": "...", "body": "..." } — default monta o
// resumo automático: overdue tasks + consultas do dia.


export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!(await verifyWebhookHmac(req, rawBody, process.env.WEBHOOK_SECRET))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
  }

  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web Push não configurado" }, { status: 501 })
  }

  const ownerId = resolveWebhookOwnerId()
  if (!ownerId) {
    return NextResponse.json({ error: "Servidor não configurado" }, { status: 500 })
  }

  const body = rawBody ? (JSON.parse(rawBody) as { title?: string; body?: string }) : {}
  let title = typeof body.title === "string" ? body.title.slice(0, 100) : ""
  let pushBody = typeof body.body === "string" ? body.body.slice(0, 400) : ""

  // Monta briefing automático se não veio payload custom
  if (!title || !pushBody) {
    const supabase = createServiceClient()
    const nowIso = new Date().toISOString()
    const todayEnd = new Date(Date.now() + 24 * 60 * 60_000).toISOString()

    const [overdueRes, apptRes] = await Promise.all([
      supabase
        .from("task")
        .select("id")
        .eq("owner_id", ownerId)
        .in("status", ["todo", "doing"])
        .lt("due_at", nowIso)
        .limit(50),
      supabase
        .from("appointment")
        .select("id, starts_at")
        .eq("owner_id", ownerId)
        .gte("starts_at", nowIso)
        .lt("starts_at", todayEnd)
        .limit(10),
    ])

    const overdueCount = overdueRes.data?.length ?? 0
    const apptCount = apptRes.data?.length ?? 0

    if (overdueCount === 0 && apptCount === 0) {
      logger.info("push-send", "Nada a notificar", {})
      return NextResponse.json({ ok: true, sent: 0, skipped: "nada pendente" })
    }

    title = "Ops Hub — Briefing"
    const parts: string[] = []
    if (overdueCount > 0) parts.push(`${overdueCount} task(s) atrasada(s)`)
    if (apptCount > 0) parts.push(`${apptCount} consulta(s) nas próximas 24h`)
    pushBody = parts.join(" · ")
  }

  try {
    const { sent, removed } = await sendPushToOwner(ownerId, {
      title,
      body: pushBody,
      tag: "daily-briefing",
      url: "/dashboard",
    })
    logger.info("push-send", "Briefing enviado", { sent, removed })
    return NextResponse.json({ ok: true, sent, removed })
  } catch (err) {
    logger.error("push-send", "Falha no push", { error: (err as Error).message })
    return NextResponse.json({ error: "falha no envio" }, { status: 500 })
  }
}