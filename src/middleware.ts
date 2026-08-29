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

/**
 * CSP com nonce — padrão da doc oficial do Next.js
 * (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md):
 *
 * 1. Proxy (middleware) gera nonce por request e seta o header CSP
 * 2. Next extrai o nonce do header e aplica automaticamente em TODOS os
 *    scripts/estilos do framework (React, runtime, bundles, inline styles)
 * 3. 'strict-dynamic' propaga confiança para chunks carregados dinamicamente
 *
 * O nonce funciona APENAS em páginas dinamicamente renderizadas. Páginas
 * estáticas (/, /login, /callback) não têm headers por request — para elas
 * mantemos um CSP "modo compatível" com 'unsafe-inline' (risco baixo: são
 * páginas sem conteúdo do usuário e o login é OTP por e-mail).
 *
 * Páginas dinâmicas já eram a maioria (ƒ no build) — ganho de segurança real
 * sem perder as statics.
 */
function buildCsp(nonce: string, isDev: boolean, allowInline: boolean): string {
  const inlineScripts = allowInline ? " 'unsafe-inline'" : ` 'nonce-${nonce}' 'strict-dynamic'`
  const csp = `
    default-src 'self';
    script-src 'self'${inlineScripts}${isDev ? " 'unsafe-eval'" : ""};
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: blob: https: https://cdn.jsdelivr.net;
    connect-src 'self' https://api.suganuma.com.br https://ops.suganuma.com.br wss://api.suganuma.com.br;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  `
  return csp.replace(/\s{2,}/g, " ").trim()
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isDev = process.env.NODE_ENV === "development"

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
    // /login é static: CSP sem nonce (não pode ser injetado em static render)
    loginUrl.searchParams.set("csp", "compat")
    const redirect = NextResponse.redirect(loginUrl)
    redirect.headers.set("Content-Security-Policy", buildCsp("", isDev, true))
    return redirect
  }

  if (user && pathname === "/login") {
    const redirect = NextResponse.redirect(new URL("/dashboard", request.url))
    redirect.headers.set("Content-Security-Policy", buildCsp("", isDev, false))
    return redirect
  }

  // Páginas STATICAS (/, /login, /callback): o HTML foi gerado no build, sem
  // nonce nos scripts — nonce + 'strict-dynamic' bloquearia TODOS os scripts
  // do framework e a página morria sem hidratar (bug visto no iOS: botão de
  // login "desaparecia" = ficava disabled, sem handler). CSP compat: mesmo
  // padrão de antes (self + unsafe-inline) para scripts e estilos.
  const STATIC_PAGES = new Set(["/", "/login"])

  // Páginas dinâmicas autenticadas: nonce real que o Next injeta nos scripts.
  // crypto.randomUUID() é global (Web Crypto) — node:crypto não existe no Edge.
  if (STATIC_PAGES.has(pathname)) {
    const cspCompat = buildCsp("", isDev, true)
    response = NextResponse.next({ request })
    response.headers.set("Content-Security-Policy", cspCompat)
    if (pathname === "/login") return response
    // "/" redireciona para /tasks depois de setar CSP
    response = NextResponse.redirect(new URL("/tasks", request.url))
    response.headers.set("Content-Security-Policy", cspCompat)
    return response
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64")
  const cspHeader = buildCsp(nonce, isDev, false)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set("x-nonce", nonce)
  requestHeaders.set("Content-Security-Policy", cspHeader)

  response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set("Content-Security-Policy", cspHeader)
  return response
}

export const config = {
  matcher: "/:path*",
}