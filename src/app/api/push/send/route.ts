import { NextRequest, NextResponse } from "next/server"
import { verifyWebhookHmac, resolveWebhookOwnerId } from "@/lib/webhooks/hmac"
import { sendPushToOwner, isWebPushConfigured } from "@/lib/web-push"
import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logger"
import { buildBriefing } from "@/lib/push-briefing"
import { today as todayInSaoPaulo } from "@/lib/date"

// POST /api/push/send
//
// Envia o briefing diário via Web Push para todas as subscriptions do dono.
// Acionado por: GH Actions cron (matinal), MCP, ou curl manual. HMAC auth.
//
// Payload opcional: { "title": "...", "body": "..." } — default monta o
// resumo automático: o que vence hoje e amanhã, atrasadas e consultas do dia.


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
    const now = Date.now()
    const nowIso = new Date(now).toISOString()
    const next24h = new Date(now + 24 * 60 * 60_000).toISOString()
    // Limites de dia no fuso de São Paulo (UTC-3 fixo). O container roda em UTC,
    // então "hoje" não pode vir de toISOString().
    const startToday = new Date(`${todayInSaoPaulo()}T00:00:00-03:00`).getTime()
    const dayIso = (offset: number) => new Date(startToday + offset * 24 * 60 * 60_000).toISOString()

    const openTasks = () =>
      supabase.from("task").select("title").eq("owner_id", ownerId).in("status", ["todo", "doing"])

    const [overdueRes, todayRes, tomorrowRes, apptRes] = await Promise.all([
      openTasks().lt("due_at", dayIso(0)).limit(50),
      openTasks().gte("due_at", dayIso(0)).lt("due_at", dayIso(1)).order("due_at").limit(20),
      openTasks().gte("due_at", dayIso(1)).lt("due_at", dayIso(2)).order("due_at").limit(20),
      supabase
        .from("appointment")
        .select("id")
        .eq("owner_id", ownerId)
        .gte("starts_at", nowIso)
        .lt("starts_at", next24h)
        .limit(10),
    ])

    // Erro de query não pode virar "nada pendente": o usuário ficaria sem o aviso
    // (ex.: vacina do dia) sem saber. Falhar faz o job do GitHub Actions ficar vermelho.
    const failed = [overdueRes, todayRes, tomorrowRes, apptRes].find((r) => r.error)
    if (failed?.error) {
      logger.error("push-send", "Falha ao montar o briefing", { error: failed.error.message })
      return NextResponse.json({ error: "falha ao montar o briefing" }, { status: 500 })
    }

    const briefing = buildBriefing({
      overdue: overdueRes.data?.length ?? 0,
      dueToday: (todayRes.data ?? []).map((t) => t.title as string),
      dueTomorrow: (tomorrowRes.data ?? []).map((t) => t.title as string),
      appts: apptRes.data?.length ?? 0,
    })

    if (!briefing) {
      logger.info("push-send", "Nada a notificar", {})
      return NextResponse.json({ ok: true, sent: 0, skipped: "nada pendente" })
    }

    title = briefing.title
    pushBody = briefing.body
  }

  try {
    const { sent, removed } = await sendPushToOwner(ownerId, {
      title,
      body: pushBody,
      tag: "daily-briefing",
      url: "/cockpit",
    })
    logger.info("push-send", "Briefing enviado", { sent, removed })
    return NextResponse.json({ ok: true, sent, removed })
  } catch (err) {
    logger.error("push-send", "Falha no push", { error: (err as Error).message })
    return NextResponse.json({ error: "falha no envio" }, { status: 500 })
  }
}