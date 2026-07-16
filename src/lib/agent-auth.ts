import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

async function sha256hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export async function validateAgentToken(req: NextRequest): Promise<string> {
  const auth = req.headers.get("authorization") ?? ""
  if (!auth.startsWith("Bearer ops_")) {
    throw new AgentAuthError("Token inválido ou ausente")
  }

  const token = auth.slice("Bearer ".length)
  const hash = await sha256hex(token)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("agent_token")
    .select("id, owner_id, revoked_at")
    .eq("token_hash", hash)
    .single()

  if (error || !data || data.revoked_at) {
    throw new AgentAuthError("Token não encontrado ou revogado")
  }

  supabase
    .from("agent_token")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {})
    .catch(() => {})

  return data.owner_id
}

export class AgentAuthError extends Error {}

export function unauthorized(msg = "Não autorizado") {
  return NextResponse.json({ error: msg }, { status: 401 })
}

export function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}

export function serverError(msg = "Erro interno") {
  return NextResponse.json({ error: msg }, { status: 500 })
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
