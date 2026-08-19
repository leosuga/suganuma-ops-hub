import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getIssuer } from "@/lib/oauth/config"
import { issueAuthorizationCode } from "@/lib/oauth/store"
import {
  validateAuthorizeRequest,
  AuthorizeFatalError,
  AuthorizeRedirectError,
  buildRedirect,
} from "@/lib/oauth/request"
import { logger } from "@/lib/logger"

// Handler de decisão da tela de consentimento.
// Revalida TODOS os parâmetros no servidor — o corpo do POST é tratado como
// entrada não confiável, exatamente como a query string original.

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  // Proteção CSRF: só aceita submissões originadas da própria aplicação.
  const origin = req.headers.get("origin")
  if (origin && origin !== getIssuer() && new URL(origin).host !== req.headers.get("host")) {
    return NextResponse.json({ error: "Origem não permitida" }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { search?: unknown; decision?: unknown }
  if (typeof body.search !== "string" || (body.decision !== "approve" && body.decision !== "deny")) {
    return NextResponse.json({ error: "Requisição inválida" }, { status: 400 })
  }

  const search = new URLSearchParams(body.search)

  let validated
  try {
    validated = await validateAuthorizeRequest(search)
  } catch (err) {
    if (err instanceof AuthorizeRedirectError) {
      const redirectUri = search.get("redirect_uri")
      if (redirectUri) {
        return NextResponse.json({
          redirect: buildRedirect(redirectUri, {
            error: err.errorCode,
            error_description: err.message,
            state: search.get("state"),
          }),
        })
      }
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof AuthorizeFatalError) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    throw err
  }

  const { params, client } = validated

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Sessão expirada — faça login novamente" }, { status: 401 })
  }

  if (body.decision === "deny") {
    logger.info("oauth", "Autorização negada pelo usuário", { client: client.displayName })
    return NextResponse.json({
      redirect: buildRedirect(params.redirectUri, {
        error: "access_denied",
        error_description: "Usuário negou a autorização",
        state: params.state,
      }),
    })
  }

  const { code } = await issueAuthorizationCode({
    ownerId: user.id,
    clientId: params.clientId,
    redirectUri: params.redirectUri,
    scope: params.scope,
    codeChallenge: params.codeChallenge,
    resource: params.resource,
  })

  logger.info("oauth", "Authorization code emitido", {
    client: client.displayName,
    scope: params.scope,
  })

  return NextResponse.json({
    redirect: buildRedirect(params.redirectUri, { code, state: params.state }),
  })
}
