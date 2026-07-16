import { type NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { checkAgentRateLimit, cleanupStaleRateLimitBuckets } from "@/lib/mcp/rate-limit"

const BYPASS = [
  /^\/_next\//,
  /^\/api\//,
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
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.ip ?? "unknown"
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
    return NextResponse.redirect(new URL("/login", request.url))
  }

  if (user && pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return response
}

export const config = {
  matcher: "/:path*",
}
