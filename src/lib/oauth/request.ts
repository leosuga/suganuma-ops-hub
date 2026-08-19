// Validação dos parâmetros do endpoint /authorize.
// Compartilhada entre a página de consentimento (GET) e o handler de aprovação (POST),
// para que os dois validem exatamente as mesmas regras — nada vindo de campo oculto
// do formulário é aceito sem revalidação.

import { SUPPORTED_SCOPES, SCOPE_READ, SCOPE_WRITE, SCOPE_OFFLINE, getResourceUrl } from "./config"
import { resolveClient, redirectUriMatches, ClientResolutionError, type ResolvedClient } from "./clients"

export interface AuthorizeParams {
  clientId: string
  redirectUri: string
  scope: string
  state: string | null
  codeChallenge: string
  resource: string | null
}

export interface ValidatedAuthorizeRequest {
  params: AuthorizeParams
  client: ResolvedClient
}

/**
 * Erro que NÃO pode ser devolvido via redirect (client_id ou redirect_uri inválidos).
 * Nesses casos o RFC 6749 §4.1.2.1 exige informar o usuário diretamente.
 */
export class AuthorizeFatalError extends Error {}

/** Erro que deve ser devolvido ao cliente via redirect com ?error=... */
export class AuthorizeRedirectError extends Error {
  constructor(
    public readonly errorCode: string,
    message: string
  ) {
    super(message)
  }
}

function normalizeScope(requested: string | null): string {
  const asked = (requested ?? "").split(/\s+/).filter(Boolean)
  const granted = asked.filter((s) => (SUPPORTED_SCOPES as readonly string[]).includes(s))
  // Sem escopo pedido, concede o padrão de leitura+escrita (o conector precisa dos dois
  // para as tools de mutação) mais refresh token.
  if (granted.length === 0) return [SCOPE_READ, SCOPE_WRITE, SCOPE_OFFLINE].join(" ")
  return granted.join(" ")
}

export async function validateAuthorizeRequest(
  search: URLSearchParams
): Promise<ValidatedAuthorizeRequest> {
  const clientId = search.get("client_id")
  const redirectUri = search.get("redirect_uri")

  if (!clientId) throw new AuthorizeFatalError("Parâmetro client_id ausente")
  if (!redirectUri) throw new AuthorizeFatalError("Parâmetro redirect_uri ausente")

  let client: ResolvedClient
  try {
    client = await resolveClient(clientId)
  } catch (err) {
    throw new AuthorizeFatalError(
      err instanceof ClientResolutionError ? err.message : "Não foi possível resolver o cliente"
    )
  }

  if (!client.redirectUris.some((uri) => redirectUriMatches(uri, redirectUri))) {
    throw new AuthorizeFatalError("redirect_uri não está registrado para este cliente")
  }

  // A partir daqui os erros podem voltar por redirect com segurança.
  const responseType = search.get("response_type")
  if (responseType !== "code") {
    throw new AuthorizeRedirectError("unsupported_response_type", "Apenas response_type=code é suportado")
  }

  const codeChallenge = search.get("code_challenge")
  const method = search.get("code_challenge_method")
  if (!codeChallenge) {
    throw new AuthorizeRedirectError("invalid_request", "PKCE é obrigatório: code_challenge ausente")
  }
  if (method !== "S256") {
    throw new AuthorizeRedirectError("invalid_request", "Apenas code_challenge_method=S256 é suportado")
  }

  const resource = search.get("resource")
  if (resource && resource.replace(/\/+$/, "") !== getResourceUrl()) {
    throw new AuthorizeRedirectError("invalid_target", "Parâmetro resource não corresponde a este servidor")
  }

  return {
    params: {
      clientId,
      redirectUri,
      scope: normalizeScope(search.get("scope")),
      state: search.get("state"),
      codeChallenge,
      resource,
    },
    client,
  }
}

/** Monta a URL de retorno para o cliente, preservando o state. */
export function buildRedirect(
  redirectUri: string,
  values: Record<string, string | null | undefined>
): string {
  const url = new URL(redirectUri)
  for (const [key, value] of Object.entries(values)) {
    if (value) url.searchParams.set(key, value)
  }
  return url.toString()
}
