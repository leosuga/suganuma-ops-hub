import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

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

  // Fire-and-forget — não bloqueia a resposta
  supabase
    .from("agent_token")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(() => {})

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
