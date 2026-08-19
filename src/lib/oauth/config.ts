// Configuração central do authorization server OAuth 2.1 do Ops Hub.
//
// O hub atua simultaneamente como Resource Server (o endpoint /api/mcp) e como
// Authorization Server (endpoints /authorize e /api/oauth/token). O fluxo suportado
// é authorization_code + PKCE S256, com clientes públicos identificados por
// CIMD (Client ID Metadata Document) ou por Dynamic Client Registration.

export const SCOPE_READ = "ops:read"
export const SCOPE_WRITE = "ops:write"
export const SCOPE_OFFLINE = "offline_access"

/** Escopos que o servidor anuncia e aceita. */
export const SUPPORTED_SCOPES = [SCOPE_READ, SCOPE_WRITE, SCOPE_OFFLINE] as const

/** Escopos concedidos a tokens de agente legados (prefixo ops_): acesso total. */
export const FULL_SCOPES = [SCOPE_READ, SCOPE_WRITE]

/** Tempo de vida do authorization code (segundos). Curto por design — RFC 6749 §4.1.2. */
export const CODE_TTL_SECONDS = 300

/** Tempo de vida do access token (segundos). */
export const ACCESS_TOKEN_TTL_SECONDS = Number(process.env.OAUTH_ACCESS_TOKEN_TTL ?? 3600)

/** Tempo de vida do refresh token (segundos). Rotacionado a cada uso. */
export const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.OAUTH_REFRESH_TOKEN_TTL ?? 60 * 24 * 3600)

/** Timeout para buscar o Client ID Metadata Document de um cliente. */
export const CIMD_FETCH_TIMEOUT_MS = 5000

/**
 * Issuer / base URL público do servidor. Precisa bater exatamente com o que o
 * cliente usa para alcançar o MCP, senão a validação de `resource` falha.
 */
export function getIssuer(): string {
  const raw = process.env.OAUTH_ISSUER ?? process.env.NEXT_PUBLIC_APP_URL ?? "https://ops.suganuma.com.br"
  return raw.replace(/\/+$/, "")
}

/** URL canônica do recurso protegido (o endpoint MCP). */
export function getResourceUrl(): string {
  return `${getIssuer()}/api/mcp`
}

/** URL do documento de Protected Resource Metadata (RFC 9728). */
export function getProtectedResourceMetadataUrl(): string {
  return `${getIssuer()}/.well-known/oauth-protected-resource/api/mcp`
}

/** Protected Resource Metadata — RFC 9728. */
export function protectedResourceMetadata() {
  return {
    resource: getResourceUrl(),
    authorization_servers: [getIssuer()],
    bearer_methods_supported: ["header"],
    scopes_supported: [...SUPPORTED_SCOPES],
    resource_documentation: `${getIssuer()}/settings`,
  }
}

/** Authorization Server Metadata — RFC 8414. */
export function authorizationServerMetadata() {
  const issuer = getIssuer()
  return {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    scopes_supported: [...SUPPORTED_SCOPES],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    // "none" é obrigatório para que o Claude selecione CIMD: o cliente dele
    // autentica como public client (sem client_secret), usando apenas PKCE.
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    client_id_metadata_document_supported: true,
  }
}
