import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import { createMcpServer } from "@/lib/mcp/server"
import {
  validateMcpAuth,
  McpAuthError,
  corsHeaders,
  isAllowedOrigin,
  validateHostHeader,
  wwwAuthenticateHeader,
} from "@/lib/mcp/auth"
import { checkMcpRateLimit, cleanupStaleRateLimitBuckets } from "@/lib/mcp/rate-limit"
import type { McpToolContext } from "@/lib/mcp/types"

// In-memory session store. In multi-instance deployments this would need a shared store;
// for a single Docker container behind Caddy this is sufficient for Fase 1.
interface Session {
  transport: WebStandardStreamableHTTPServerTransport
  ctx: McpToolContext
  createdAt: number
}

const sessions = new Map<string, Session>()

// Sessões abandonadas (cliente sumiu sem fechar o transporte) nunca seriam
// evitadas — o Map só remove no onclose. TTL de 24h conta a partir da criação;
// renovação implícita não é necessária: clientes ativos reconectam.
const MCP_SESSION_TTL_MS = Number(process.env.MCP_SESSION_TTL_MS) || 24 * 60 * 60_000

function cleanupExpiredSessions() {
  const now = Date.now()
  for (const [id, session] of sessions) {
    if (now - session.createdAt > MCP_SESSION_TTL_MS) {
      session.transport.onclose = undefined
      sessions.delete(id)
    }
  }
}

// Periodic cleanup of stale rate-limit buckets to prevent memory growth in long-running containers.
// Runs every 5 minutes; buckets older than 10 minutes past their reset window are evicted.
// Also evicts MCP sessions older than the TTL.
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    cleanupStaleRateLimitBuckets(10 * 60_000)
    cleanupExpiredSessions()
  }, 5 * 60_000).unref?.()
}

function cleanupSession(sessionId: string) {
  const session = sessions.get(sessionId)
  if (session) {
    session.transport.onclose = undefined
    sessions.delete(sessionId)
  }
}

/**
 * IP do cliente.
 *
 * Usa a entrada MAIS À DIREITA de X-Forwarded-For: essa é a que o proxy confiável
 * (Caddy) anexou. A primeira entrada é controlada por quem faz a requisição e
 * poderia ser forjada para escapar do rate limit.
 */
function clientIpFrom(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for")
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean)
    if (parts.length > 0) return parts[parts.length - 1]
  }
  return req.headers.get("x-real-ip") ?? "unknown"
}

function unauthorizedResponse(origin: string | null, message: string) {
  return new NextResponse(
    JSON.stringify({ error: "invalid_token", error_description: message }),
    {
      status: 401,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": "application/json",
        // Sem este header o cliente não descobre o authorization server e
        // nunca oferece o botão de conectar.
        "WWW-Authenticate": wwwAuthenticateHeader("invalid_token", message),
      },
    }
  )
}

async function handleMcpRequest(req: NextRequest): Promise<Response> {
  const origin = req.headers.get("origin")
  const sessionId = req.headers.get("mcp-session-id") ?? undefined

  try {
    validateHostHeader(req)
  } catch (err) {
    const status = err instanceof McpAuthError ? err.status : 500
    return new NextResponse(
      JSON.stringify({ error: err instanceof Error ? err.message : "Host inválido" }),
      { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } }
    )
  }

  const rateLimit = checkMcpRateLimit(clientIpFrom(req))
  if (!rateLimit.allowed) {
    return new NextResponse(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: `Rate limit exceeded: ${rateLimit.retryAfter}s` },
        id: null,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(rateLimit.retryAfter),
          ...corsHeaders(origin),
        },
      }
    )
  }

  let body: unknown | undefined
  if (req.method === "POST") {
    body = await req.json().catch(() => undefined)
  }

  // Toda requisição revalida o portador. Isso mantém a revogação e a expiração
  // efetivas dentro de uma sessão já aberta, e permite que o cliente troque um
  // access token renovado sem reabrir a sessão.
  let auth: { ownerId: string; token: string; scopes: string[] }
  try {
    auth = await validateMcpAuth(req)
  } catch (err) {
    if (err instanceof McpAuthError && err.status === 401) {
      return unauthorizedResponse(origin, err.message)
    }
    const status = err instanceof McpAuthError ? err.status : 500
    return new NextResponse(JSON.stringify({ error: err instanceof Error ? err.message : "Auth error" }), {
      status,
      headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    })
  }

  let transport: WebStandardStreamableHTTPServerTransport

  const existing = sessionId ? sessions.get(sessionId) : undefined

  if (existing) {
    // A sessão pertence a um dono; um token de outro dono nunca a reaproveita.
    if (existing.ctx.ownerId !== auth.ownerId) {
      return unauthorizedResponse(origin, "Sessão pertence a outro usuário")
    }
    existing.ctx.token = auth.token
    existing.ctx.scopes = auth.scopes
    transport = existing.transport
  } else if (!sessionId && body && isInitializeRequest(body)) {
    const newSessionId = randomUUID()
    const ctx: McpToolContext = {
      ownerId: auth.ownerId,
      token: auth.token,
      scopes: auth.scopes,
      baseUrl: "http://127.0.0.1:3000",
    }

    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (id) => {
        sessions.set(id, { transport, ctx, createdAt: Date.now() })
      },
    })

    transport.onclose = () => cleanupSession(newSessionId)

    const server = createMcpServer(ctx)
    await server.connect(transport)
  } else {
    return new NextResponse(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: no valid session ID" },
        id: null,
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
      }
    )
  }

  return await transport.handleRequest(req as unknown as Request, {
    parsedBody: body,
  })
}

export async function POST(req: NextRequest) {
  return handleMcpRequest(req)
}

export async function GET(req: NextRequest) {
  return handleMcpRequest(req)
}

export async function DELETE(req: NextRequest) {
  return handleMcpRequest(req)
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin")
  if (!isAllowedOrigin(origin)) {
    return new NextResponse(null, { status: 403 })
  }
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) })
}
