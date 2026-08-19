import { NextRequest } from "next/server"
import { resolveBearer, AgentAuthError } from "@/lib/agent-auth"
import { getProtectedResourceMetadataUrl, SUPPORTED_SCOPES } from "@/lib/oauth/config"

// Allowed origins for CORS. In dev/test we allow null (desktop clients) and same-origin.
const ALLOWED_ORIGINS = process.env.MCP_ALLOWED_ORIGINS
  ? process.env.MCP_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "https://ops.suganuma.com.br",
      "https://claude.ai",
      "https://openclaw.ai",
      "https://app.openclaw.ai",
      "https://vscode.dev",
      "https://insiders.vscode.dev",
      "null",
    ]

export interface McpAuthResult {
  ownerId: string
  token: string
  scopes: string[]
}

export async function validateMcpAuth(req: NextRequest): Promise<McpAuthResult> {
  try {
    const bearer = await resolveBearer(req)
    const auth = req.headers.get("authorization") ?? ""
    const token = auth.slice("Bearer ".length).trim()
    return { ownerId: bearer.ownerId, token, scopes: bearer.scopes }
  } catch (err) {
    if (err instanceof AgentAuthError) {
      throw new McpAuthError(err.message, 401)
    }
    throw new McpAuthError("Falha na autenticacao", 500)
  }
}

export class McpAuthError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message)
  }
}

/**
 * Header WWW-Authenticate do desafio 401.
 *
 * É este header — e o status 401, não um erro de tool dentro de um 200 — que faz
 * o cliente MCP descobrir o authorization server e iniciar o fluxo OAuth.
 * Ver RFC 9728 e a especificação de autorização do MCP.
 */
export function wwwAuthenticateHeader(error = "invalid_token", description?: string): string {
  const parts = [
    `Bearer error="${error}"`,
    description ? `error_description="${description.replace(/"/g, "'")}"` : null,
    `resource_metadata="${getProtectedResourceMetadataUrl()}"`,
    `scope="${SUPPORTED_SCOPES.join(" ")}"`,
  ].filter(Boolean)
  return parts.join(", ")
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true
  if (ALLOWED_ORIGINS.includes("*")) return true
  return ALLOWED_ORIGINS.includes(origin)
}

export function corsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? origin ?? "*" : ""
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Last-Event-ID",
    "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version, WWW-Authenticate",
    "Access-Control-Max-Age": "86400",
  }
}

export function validateHostHeader(req: NextRequest): void {
  const host = req.headers.get("host")
  const allowedHosts = process.env.MCP_ALLOWED_HOSTS
    ? process.env.MCP_ALLOWED_HOSTS.split(",").map((h) => h.trim())
    : ["ops.suganuma.com.br", "localhost:3000", "127.0.0.1:3000"]
  // Requisição sem Host é rejeitada: aceitar o caso ausente enfraquece a
  // proteção contra DNS rebinding.
  if (!host || !allowedHosts.includes(host)) {
    throw new McpAuthError(`Host nao permitido: ${host ?? "(ausente)"}`, 400)
  }
}
