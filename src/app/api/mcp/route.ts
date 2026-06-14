import { type NextRequest, NextResponse } from "next/server"
import { randomUUID } from "node:crypto"
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import { createMcpServer } from "@/lib/mcp/server"
import { validateMcpAuth, McpAuthError, corsHeaders, isAllowedOrigin, validateHostHeader } from "@/lib/mcp/auth"
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit"

// In-memory session store. In multi-instance deployments this would need a shared store;
// for a single Docker container behind Caddy this is sufficient for Fase 1.
const transports = new Map<string, WebStandardStreamableHTTPServerTransport>()

function cleanupSession(sessionId: string) {
  const t = transports.get(sessionId)
  if (t) {
    t.onclose = undefined
    transports.delete(sessionId)
  }
}

async function handleMcpRequest(req: NextRequest): Promise<Response> {
  const origin = req.headers.get("origin")
  const sessionId = req.headers.get("mcp-session-id") ?? undefined

  validateHostHeader(req)

  // Rate limiting por IP (Caddy X-Forwarded-For ou remoteAddress)
  const clientIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.ip ?? "unknown"
  const rateLimit = checkMcpRateLimit(clientIp)
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

  let transport: WebStandardStreamableHTTPServerTransport

  if (sessionId && transports.has(sessionId)) {
    transport = transports.get(sessionId)!
  } else if (!sessionId && body && isInitializeRequest(body)) {
    let ownerId: string
    let token: string
    try {
      const auth = await validateMcpAuth(req)
      ownerId = auth.ownerId
      token = auth.token
    } catch (err) {
      const status = err instanceof McpAuthError ? err.status : 500
      const headers = corsHeaders(origin)
      return new NextResponse(JSON.stringify({ error: err instanceof Error ? err.message : "Auth error" }), {
        status,
        headers: { ...headers, "Content-Type": "application/json" },
      })
    }

    const newSessionId = randomUUID()
    transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (id) => {
        transports.set(id, transport)
      },
    })

    transport.onclose = () => cleanupSession(newSessionId)

    const server = createMcpServer({ ownerId, token, baseUrl: "http://127.0.0.1:3000" })
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
