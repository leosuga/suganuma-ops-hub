import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"
import { resolveAccessToken } from "@/lib/oauth/store"
import { FULL_SCOPES, SCOPE_READ, SCOPE_WRITE } from "@/lib/oauth/config"
import { logger } from "@/lib/logger"

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export interface ResolvedBearer {
  ownerId: string
  scopes: string[]
  /** "agent" = token estático ops_ gerado em Settings; "oauth" = access token OAuth. */
  kind: "agent" | "oauth"
}

function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get("authorization") ?? ""
  if (!auth.startsWith("Bearer ")) return null
  const token = auth.slice("Bearer ".length).trim()
  return token.length > 0 ? token : null
}

/**
 * Resolve o portador da requisição, aceitando os dois esquemas:
 *
 * - `ops_...`  — token de agente estático (Settings → Agent Tokens). Acesso total.
 * - `opsa_...` — access token OAuth, com os escopos concedidos no consentimento.
 */
export async function resolveBearer(req: NextRequest): Promise<ResolvedBearer> {
  const token = extractBearer(req)
  if (!token) throw new AgentAuthError("Token inválido ou ausente")

  if (token.startsWith("ops_")) {
    const hash = await sha256hex(token)
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("agent_token")
      .select("id, owner_id, revoked_at")
      .eq("token_hash", hash)
      .maybeSingle()

    if (error || !data || data.revoked_at) {
      throw new AgentAuthError("Token não encontrado ou revogado")
    }

    void (async () => {
      try {
        await supabase
          .from("agent_token")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", data.id)
      } catch {
        // best-effort update — não bloqueia a request
      }
    })()

    return { ownerId: data.owner_id, scopes: [...FULL_SCOPES], kind: "agent" }
  }

  const oauth = await resolveAccessToken(token)
  if (!oauth) throw new AgentAuthError("Token não encontrado, expirado ou revogado")

  return { ownerId: oauth.ownerId, scopes: oauth.scopes, kind: "oauth" }
}

/** Escopo exigido por método HTTP: leitura para GET/HEAD, escrita para o resto. */
export function requiredScopeForMethod(method: string): string {
  return method === "GET" || method === "HEAD" ? SCOPE_READ : SCOPE_WRITE
}

/**
 * Valida o portador e devolve o owner_id.
 *
 * Também aplica o escopo: uma conexão concedida apenas como somente-leitura não
 * consegue chamar rotas de mutação, mesmo que a tool tente.
 */
export async function validateAgentToken(req: NextRequest): Promise<string> {
  const bearer = await resolveBearer(req)
  const needed = requiredScopeForMethod(req.method)
  if (!bearer.scopes.includes(needed)) {
    throw new AgentScopeError(`Escopo insuficiente: ${needed} é necessário`)
  }
  return bearer.ownerId
}

export class AgentAuthError extends Error {}
export class AgentScopeError extends Error {}

export function unauthorized(msg = "Não autorizado") {
  return NextResponse.json({ error: msg }, { status: 401 })
}

export function forbidden(msg = "Escopo insuficiente") {
  return NextResponse.json({ error: msg }, { status: 403 })
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

export function serverError(msg = "Erro interno") {
  // Mensagens de erro do Supabase/DB vazam detalhes de schema. Mascarar com
  // correlation id: o detalhe real fica nos logs do servidor para debug.
  const correlationId = crypto.randomUUID()
  logger.error("agent-api", "Internal error (details masked to client)", {
    correlationId,
    originalMessage: msg,
  })
  return NextResponse.json(
    { error: `Erro interno (ref: ${correlationId})` },
    { status: 500 },
  )
}

// ── Query param & path param validation helpers ──

const uuidSchema = z.string().uuid()

export function validateUuidParam(value: string): boolean {
  return uuidSchema.safeParse(value).success
}

const monthSchema = z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM")
const isoDateTimeSchema = z.string().datetime()
const healthKindSchema = z.enum(["weight", "blood_pressure", "glucose", "heart_rate", "sleep", "medication", "symptom", "note"])

export function parseMonthParam(value: string | null): string {
  const fallback = new Date().toISOString().slice(0, 7)
  if (!value) return fallback
  const parsed = monthSchema.safeParse(value)
  return parsed.success ? value : fallback
}

export function validateIsoDateTime(value: string | null): string | null {
  if (!value) return null
  return isoDateTimeSchema.safeParse(value).success ? value : null
}

export function validateHealthKind(value: string | null): string | null {
  if (!value) return null
  return healthKindSchema.safeParse(value).success ? value : null
}

export function parseLimitParam(value: string | null, fallback: number, max: number): number {
  const n = Number(value ?? String(fallback))
  if (isNaN(n) || n < 1) return fallback
  return Math.min(n, max)
}
