import { NextRequest, NextResponse } from "next/server"
import { exchangeAuthorizationCode, refreshTokens, OAuthGrantError } from "@/lib/oauth/store"
import { logger } from "@/lib/logger"

// Token endpoint — RFC 6749 §3.2.
//
// Aceita application/x-www-form-urlencoded (obrigatório: é o que o Claude envia,
// tanto na troca inicial quanto no refresh) e também JSON, por conveniência.
// Cliente público: nenhum client_secret é exigido.

export const dynamic = "force-dynamic"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" }

function errorResponse(code: string, description: string, status = 400) {
  return NextResponse.json(
    { error: code, error_description: description },
    { status, headers: { ...CORS, ...NO_STORE } }
  )
}

async function readParams(req: NextRequest): Promise<Record<string, string>> {
  const contentType = req.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [key, value] of Object.entries(body)) {
      if (typeof value === "string") out[key] = value
    }
    return out
  }
  const form = await req.formData().catch(() => null)
  if (!form) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of form.entries()) {
    if (typeof value === "string") out[key] = value
  }
  return out
}

export async function POST(req: NextRequest) {
  const params = await readParams(req)
  const grantType = params.grant_type

  // Cliente público autentica só com client_id no corpo; se vier Basic auth,
  // aceita o client_id de lá também.
  let clientId = params.client_id ?? ""
  const auth = req.headers.get("authorization")
  if (!clientId && auth?.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice("Basic ".length))
      clientId = decodeURIComponent(decoded.split(":")[0] ?? "")
    } catch {
      // ignora credenciais Basic malformadas
    }
  }

  if (!clientId) return errorResponse("invalid_client", "client_id ausente")

  try {
    if (grantType === "authorization_code") {
      if (!params.code) return errorResponse("invalid_request", "code ausente")
      if (!params.redirect_uri) return errorResponse("invalid_request", "redirect_uri ausente")
      if (!params.code_verifier) return errorResponse("invalid_request", "code_verifier ausente")

      const tokens = await exchangeAuthorizationCode({
        code: params.code,
        clientId,
        redirectUri: params.redirect_uri,
        codeVerifier: params.code_verifier,
      })

      return NextResponse.json(
        {
          access_token: tokens.accessToken,
          token_type: "Bearer",
          expires_in: tokens.expiresIn,
          refresh_token: tokens.refreshToken,
          scope: tokens.scope,
        },
        { headers: { ...CORS, ...NO_STORE } }
      )
    }

    if (grantType === "refresh_token") {
      if (!params.refresh_token) return errorResponse("invalid_request", "refresh_token ausente")

      const tokens = await refreshTokens({ refreshToken: params.refresh_token, clientId })

      return NextResponse.json(
        {
          access_token: tokens.accessToken,
          token_type: "Bearer",
          expires_in: tokens.expiresIn,
          refresh_token: tokens.refreshToken,
          scope: tokens.scope,
        },
        { headers: { ...CORS, ...NO_STORE } }
      )
    }

    return errorResponse("unsupported_grant_type", `grant_type não suportado: ${grantType ?? "(ausente)"}`)
  } catch (err) {
    if (err instanceof OAuthGrantError) {
      // Códigos RFC 6749: o cliente depende de "invalid_grant" para saber que
      // precisa refazer o fluxo de autorização em vez de tentar de novo.
      logger.warn("oauth", "Grant recusado", { code: err.code, message: err.message })
      return errorResponse(err.code, err.message, err.code === "server_error" ? 500 : 400)
    }
    logger.error("oauth", "Erro inesperado no token endpoint", {
      error: err instanceof Error ? err.message : String(err),
    })
    return errorResponse("server_error", "Erro interno", 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
