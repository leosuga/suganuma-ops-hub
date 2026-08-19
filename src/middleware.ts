import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { checkAgentRateLimit, cleanupStaleRateLimitBuckets } from "@/lib/mcp/rate-limit"

const BYPASS = [
  /^\/_next\//,
  /^\/api\//,
  // Discovery OAuth precisa ser público: se cair no redirect para /login, o
  // cliente MCP nunca encontra o authorization server.
  /^\/\.well-known\//,
  /^\/sw\.js$/,
  /^\/manifest\.webmanifest$/,
  /^\/favicon\.ico$/,
  /\.(svg|png|jpg|jpeg|gif|webp|ico)$/,
]

// Rate limiting for agent API — applied before the general /api/ bypass.
const AGENT_PATH = /^\/api\/agent\//

if (typeof setInterval !== "undefined") {
  setInterval(() => cleanupStaleRateLimitBuckets(10 * 60_000), 5 * 60_000).unref?.()
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Agent API rate limiting (before auth/redirect logic)
  if (AGENT_PATH.test(pathname)) {
    // Entrada mais à direita do X-Forwarded-For: é a que o proxy confiável (Caddy)
    // anexou. A primeira é controlada pelo cliente e poderia ser forjada para
    // gerar um bucket novo a cada requisição, anulando o rate limit.
    const forwarded = request.headers.get("x-forwarded-for")?.split(",").map((p) => p.trim()).filter(Boolean)
    const clientIp = forwarded?.[forwarded.length - 1] ?? request.headers.get("x-real-ip") ?? "unknown"
    const rateLimit = checkAgentRateLimit(clientIp)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Rate limit exceeded: retry in ${rateLimit.retryAfter}s` },
        { status: 429, headers: { "Retry-After": String(rateLimit.retryAfter) } }
      )
    }
    return NextResponse.next({ request })
  }

  if (BYPASS.some((r) => r.test(pathname))) {
    return NextResponse.next({ request })
  }

  // Allow callback route for magic link auth
  if (pathname === "/callback") {
    return NextResponse.next({ request })
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && pathname !== "/login") {
    // Preserva o destino: sem isso, um fluxo OAuth iniciado em /authorize se perde
    // no login e o usuário precisa recomeçar a conexão do zero.
    const loginUrl = new URL("/login", request.url)
    const target = `${pathname}${request.nextUrl.search}`
    if (target !== "/" && target !== "/dashboard") {
      loginUrl.searchParams.set("next", target)
    }
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return response
}

export const config = {
  matcher: "/:path*",
}
