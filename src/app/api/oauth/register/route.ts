import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { randomSecret } from "@/lib/oauth/crypto"
import { logger } from "@/lib/logger"

// Dynamic Client Registration — RFC 7591.
//
// Fallback para clientes que não suportam CIMD. O Claude prefere CIMD (anunciado
// nos metadados do authorization server), então este endpoint raramente é usado;
// existe para não deixar nenhum cliente MCP de fora.
//
// Registro é aberto por design (é o modelo do RFC para clientes públicos), mas
// registrar um cliente não concede nada: qualquer acesso ainda exige que o dono
// aprove explicitamente na tela de consentimento.

export const dynamic = "force-dynamic"

const MAX_REDIRECT_URIS = 10

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function isAcceptableRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri)
    if (u.protocol === "https:") return true
    // Loopback em http é permitido para clientes nativos (RFC 8252 §7.3).
    const host = u.hostname.replace(/^\[|\]$/g, "")
    return u.protocol === "http:" && (host === "127.0.0.1" || host === "::1" || host === "localhost")
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    redirect_uris?: unknown
    client_name?: unknown
  } | null

  if (!body || !Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
    return NextResponse.json(
      { error: "invalid_client_metadata", error_description: "redirect_uris é obrigatório" },
      { status: 400, headers: CORS }
    )
  }

  const redirectUris = body.redirect_uris
    .filter((u): u is string => typeof u === "string")
    .filter(isAcceptableRedirectUri)
    .slice(0, MAX_REDIRECT_URIS)

  if (redirectUris.length === 0) {
    return NextResponse.json(
      {
        error: "invalid_redirect_uri",
        error_description: "Nenhum redirect_uri aceitável (https, ou http em loopback)",
      },
      { status: 400, headers: CORS }
    )
  }

  const clientId = randomSecret("opscl_")
  const clientName = typeof body.client_name === "string" ? body.client_name.slice(0, 120) : null

  const supabase = createServiceClient()
  const { error } = await supabase.from("oauth_client").insert({
    client_id: clientId,
    client_name: clientName,
    redirect_uris: redirectUris,
  })

  if (error) {
    logger.error("oauth", "Falha ao registrar cliente", { error: error.message })
    return NextResponse.json(
      { error: "server_error", error_description: "Falha ao registrar cliente" },
      { status: 500, headers: CORS }
    )
  }

  logger.info("oauth", "Cliente registrado via DCR", { clientName })

  return NextResponse.json(
    {
      client_id: clientId,
      client_name: clientName ?? undefined,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: { ...CORS, "Cache-Control": "no-store" } }
  )
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
