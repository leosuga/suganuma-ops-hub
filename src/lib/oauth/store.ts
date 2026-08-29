// Emissão e validação de authorization codes, access tokens e refresh tokens.
//
// Nenhum segredo é gravado em claro: todas as tabelas guardam apenas o SHA-256.
// Como os segredos têm 256 bits de entropia aleatória, hash sem salt é adequado
// (não há espaço de busca para força bruta ou rainbow table).

import { createServiceClient } from "@/lib/supabase/service"
import { sha256hex, sha256base64url, randomSecret, timingSafeEqualStr } from "./crypto"
import {
  ACCESS_TOKEN_TTL_SECONDS,
  CODE_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  SCOPE_OFFLINE,
} from "./config"

export interface IssuedCode {
  code: string
  expiresAt: Date
}

export interface IssuedTokens {
  accessToken: string
  refreshToken?: string
  expiresIn: number
  scope: string
}

export interface ResolvedToken {
  ownerId: string
  scopes: string[]
}

export class OAuthGrantError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "invalid_grant"
      | "invalid_request"
      | "invalid_client"
      | "unsupported_grant_type"
      | "server_error" = "invalid_grant"
  ) {
    super(message)
  }
}

function nowPlus(seconds: number): Date {
  return new Date(Date.now() + seconds * 1000)
}

/** Cria um authorization code de uso único, ligado ao PKCE challenge. */
export async function issueAuthorizationCode(params: {
  ownerId: string
  clientId: string
  redirectUri: string
  scope: string
  codeChallenge: string
  resource?: string | null
}): Promise<IssuedCode> {
  const code = randomSecret("opsc_")
  const expiresAt = nowPlus(CODE_TTL_SECONDS)

  const supabase = createServiceClient()
  const { error } = await supabase.from("oauth_authorization_code").insert({
    code_hash: await sha256hex(code),
    owner_id: params.ownerId,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scope,
    code_challenge: params.codeChallenge,
    resource: params.resource ?? null,
    expires_at: expiresAt.toISOString(),
  })

  if (error) throw new OAuthGrantError(`Falha ao emitir authorization code: ${error.message}`, "server_error")
  return { code, expiresAt }
}

async function persistTokens(params: {
  ownerId: string
  clientId: string
  scope: string
  withRefresh: boolean
}): Promise<IssuedTokens> {
  const accessToken = randomSecret("opsa_")
  const refreshToken = params.withRefresh ? randomSecret("opsr_") : undefined

  const supabase = createServiceClient()
  const { error } = await supabase.from("oauth_token").insert({
    owner_id: params.ownerId,
    client_id: params.clientId,
    scope: params.scope,
    access_token_hash: await sha256hex(accessToken),
    refresh_token_hash: refreshToken ? await sha256hex(refreshToken) : null,
    access_expires_at: nowPlus(ACCESS_TOKEN_TTL_SECONDS).toISOString(),
    refresh_expires_at: refreshToken ? nowPlus(REFRESH_TOKEN_TTL_SECONDS).toISOString() : null,
  })

  if (error) throw new OAuthGrantError(`Falha ao emitir tokens: ${error.message}`, "server_error")

  return {
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    scope: params.scope,
  }
}

/**
 * Troca um authorization code por tokens.
 *
 * Valida: existência, expiração, uso único, vínculo com client_id e redirect_uri,
 * e o code_verifier do PKCE (S256).
 */
export async function exchangeAuthorizationCode(params: {
  code: string
  clientId: string
  redirectUri: string
  codeVerifier: string
}): Promise<IssuedTokens> {
  const supabase = createServiceClient()
  const codeHash = await sha256hex(params.code)

  const { data, error } = await supabase
    .from("oauth_authorization_code")
    .select("id, owner_id, client_id, redirect_uri, scope, code_challenge, expires_at, used_at")
    .eq("code_hash", codeHash)
    .maybeSingle()

  if (error) throw new OAuthGrantError("Falha ao consultar o authorization code", "server_error")
  if (!data) throw new OAuthGrantError("Authorization code inválido")

  // Marca como usado imediatamente. Um code reapresentado nunca mais é aceito,
  // mesmo que a validação abaixo falhe (RFC 6749 §4.1.2 — code é de uso único).
  // O UPDATE condicional + checagem de linhas afetadas (não o SELECT anterior)
  // é o que torna isso atômico sob troca concorrente do mesmo code.
  const { error: claimError, data: claimed } = await supabase
    .from("oauth_authorization_code")
    .update({ used_at: new Date().toISOString() })
    .eq("id", data.id)
    .is("used_at", null)
    .select("id")

  if (claimError) throw new OAuthGrantError("Falha ao marcar o code como usado", "server_error")
  if (!claimed || claimed.length === 0) throw new OAuthGrantError("Authorization code já utilizado")
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw new OAuthGrantError("Authorization code expirado")
  }
  if (!timingSafeEqualStr(data.client_id, params.clientId)) {
    throw new OAuthGrantError("client_id não corresponde ao authorization code")
  }
  if (data.redirect_uri !== params.redirectUri) {
    throw new OAuthGrantError("redirect_uri não corresponde ao authorization code")
  }

  const expected = await sha256base64url(params.codeVerifier)
  if (!timingSafeEqualStr(expected, data.code_challenge)) {
    throw new OAuthGrantError("code_verifier inválido")
  }

  const scope: string = data.scope ?? ""
  return persistTokens({
    ownerId: data.owner_id,
    clientId: data.client_id,
    scope,
    withRefresh: scope.split(" ").includes(SCOPE_OFFLINE),
  })
}

/**
 * Rotaciona um refresh token.
 *
 * O par novo é gravado na mesma linha, o que invalida o refresh antigo no mesmo
 * instante em que o novo é retornado — exigência para clientes públicos
 * (OAuth 2.1 / MCP authorization spec).
 */
export async function refreshTokens(params: {
  refreshToken: string
  clientId: string
}): Promise<IssuedTokens> {
  const supabase = createServiceClient()
  const refreshHash = await sha256hex(params.refreshToken)

  const { data, error } = await supabase
    .from("oauth_token")
    .select("id, owner_id, client_id, scope, refresh_expires_at, revoked_at")
    .eq("refresh_token_hash", refreshHash)
    .maybeSingle()

  if (error) throw new OAuthGrantError("Falha ao consultar o refresh token", "server_error")
  if (!data) throw new OAuthGrantError("Refresh token inválido")
  if (data.revoked_at) throw new OAuthGrantError("Refresh token revogado")
  if (data.refresh_expires_at && new Date(data.refresh_expires_at).getTime() < Date.now()) {
    throw new OAuthGrantError("Refresh token expirado")
  }
  if (!timingSafeEqualStr(data.client_id, params.clientId)) {
    throw new OAuthGrantError("client_id não corresponde ao refresh token")
  }

  const accessToken = randomSecret("opsa_")
  const newRefreshToken = randomSecret("opsr_")

  const { error: updateError, data: updated } = await supabase
    .from("oauth_token")
    .update({
      access_token_hash: await sha256hex(accessToken),
      refresh_token_hash: await sha256hex(newRefreshToken),
      access_expires_at: nowPlus(ACCESS_TOKEN_TTL_SECONDS).toISOString(),
      refresh_expires_at: nowPlus(REFRESH_TOKEN_TTL_SECONDS).toISOString(),
      last_used_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .is("revoked_at", null)
    .select("id")

  if (updateError) throw new OAuthGrantError("Falha ao rotacionar o refresh token", "server_error")
  if (!updated || updated.length === 0) throw new OAuthGrantError("Refresh token não é mais válido")

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    scope: data.scope ?? "",
  }
}

/** Valida um access token OAuth. Retorna null se inválido, revogado ou expirado. */
export async function resolveAccessToken(accessToken: string): Promise<ResolvedToken | null> {
  const supabase = createServiceClient()
  const hash = await sha256hex(accessToken)

  const { data, error } = await supabase
    .from("oauth_token")
    .select("id, owner_id, scope, access_expires_at, revoked_at")
    .eq("access_token_hash", hash)
    .maybeSingle()

  if (error || !data) return null
  if (data.revoked_at) return null
  if (data.access_expires_at && new Date(data.access_expires_at).getTime() < Date.now()) return null

  // Best-effort, sem bloquear a request.
  void (async () => {
    try {
      await supabase
        .from("oauth_token")
        .update({ last_used_at: new Date().toISOString() })
        .eq("id", data.id)
    } catch {
      // best-effort
    }
  })()

  return {
    ownerId: data.owner_id,
    scopes: (data.scope ?? "").split(" ").filter(Boolean),
  }
}
