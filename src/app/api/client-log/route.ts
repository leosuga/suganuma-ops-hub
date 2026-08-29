import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { checkAgentRateLimit } from "@/lib/mcp/rate-limit"
import { logger } from "@/lib/logger"

// POST /api/client-log — recebe erros capturados no browser (window.onerror,
// unhandledrejection, onError do QueryClient). Sem auth (browser não tem
// token server-side) mas com rate limit por IP e sanitização estrita.
//
// Risco de spam é mitigado por: rate limit 60/min/IP, campo extra limitado
// a 2KB, message/stack truncados.

export const dynamic = "force-dynamic"

const MAX_MESSAGE = 500
const MAX_STACK = 4000
const MAX_EXTRA_BYTES = 2048

function clientIpFrom(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return req.headers.get("x-real-ip") ?? "unknown"
}

export async function POST(req: NextRequest) {
  const rl = checkAgentRateLimit(clientIpFrom(req))
  if (!rl.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } })
  }

  const body = (await req.json().catch(() => null)) as {
    level?: unknown
    ctx?: unknown
    message?: unknown
    stack?: unknown
    url?: unknown
    extra?: unknown
  } | null

  if (!body || typeof body.message !== "string" || body.message.trim().length === 0) {
    return NextResponse.json({ error: "message obrigatório" }, { status: 400 })
  }

  const level = body.level === "warn" ? "warn" : "error"

  // extra: só JSON simples com teto de tamanho (proteção contra payload bombs)
  let extra: unknown = null
  if (body.extra !== undefined && body.extra !== null) {
    try {
      const s = JSON.stringify(body.extra)
      if (s.length <= MAX_EXTRA_BYTES) extra = JSON.parse(s)
    } catch {
      extra = null
    }
  }

  const entry = {
    level,
    ctx: typeof body.ctx === "string" ? body.ctx.slice(0, 100) : "client",
    message: body.message.slice(0, MAX_MESSAGE),
    stack: typeof body.stack === "string" ? body.stack.slice(0, MAX_STACK) : null,
    url: typeof body.url === "string" ? body.url.slice(0, 500) : null,
    user_agent: req.headers.get("user-agent")?.slice(0, 300) ?? null,
    release: process.env.BUILD_ID ?? null,
    extra,
  }

  const { createServiceClient } = await import("@/lib/supabase/service")
  const supabase = createServiceClient()
  const { error } = await supabase.from("client_error").insert(entry)

  if (error) {
    logger.error("client-log", "Falha ao persistir erro do client", { error: error.message })
    return NextResponse.json({ error: "falha ao registrar" }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}