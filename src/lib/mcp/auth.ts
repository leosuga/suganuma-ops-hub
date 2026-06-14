import { NextRequest } from "next/server"
import { validateAgentToken, AgentAuthError } from "@/lib/agent-auth"

// Allowed origins for CORS. In dev/test we allow null (desktop clients) and same-origin.
const ALLOWED_ORIGINS = process.env.MCP_ALLOWED_ORIGINS
  ? process.env.MCP_ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "https://ops.suganuma.com.br",
      "https://openclaw.ai",
      "https://app.openclaw.ai",
      "https://vscode.dev",
      "https://insiders.vscode.dev",
      "null",
    ]

export async function validateMcpAuth(req: NextRequest): Promise<{ ownerId: string; token: string }> {
  try {
    const ownerId = await validateAgentToken(req)
    const auth = req.headers.get("authorization") ?? ""
    const token = auth.slice("Bearer ".length)
    return { ownerId, token }
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
    "Access-Control-Expose-Headers": "Mcp-Session-Id, Mcp-Protocol-Version",
    "Access-Control-Max-Age": "86400",
  }
}

export function validateHostHeader(req: NextRequest): void {
  const host = req.headers.get("host")
  const allowedHosts = process.env.MCP_ALLOWED_HOSTS
    ? process.env.MCP_ALLOWED_HOSTS.split(",").map((h) => h.trim())
    : ["ops.suganuma.com.br", "localhost:3000", "127.0.0.1:3000"]
  if (host && !allowedHosts.includes(host)) {
    throw new McpAuthError(`Host nao permitido: ${host}`, 400)
  }
}
