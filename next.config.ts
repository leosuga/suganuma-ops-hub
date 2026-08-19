import type { NextConfig } from "next"

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // CSP allows inline styles (Tailwind + styled-jsx) and self for scripts/connect.
  // 'unsafe-inline' for styles is required by Next.js styled-jsx runtime.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 'unsafe-eval' removido: React/Next.js não usam eval em produção (só em
      // dev, para reconstruir stack traces). Migrar 'unsafe-inline' para nonce
      // exigiria renderização dinâmica em todas as páginas (perde SSG/ISR) —
      // fora do escopo desta correção pontual.
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://api.suganuma.com.br https://ops.suganuma.com.br wss://api.suganuma.com.br",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
]

const nextConfig: NextConfig = {
  output: "standalone",
  images: { unoptimized: true },
  typescript: { ignoreBuildErrors: process.env.SKIP_TSC === "1" },
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ["recharts", "cmdk", "@supabase/supabase-js", "@tanstack/react-query", "react-markdown", "papaparse"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ]
  },
  // Documentos de discovery OAuth. Ficam sob /.well-known/ por especificação
  // (RFC 8414 / RFC 9728); os handlers vivem em /api/oauth/metadata/* porque o
  // App Router não roteia diretórios iniciados por ponto.
  async rewrites() {
    return [
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth/metadata/protected-resource",
      },
      {
        source: "/.well-known/oauth-protected-resource/api/mcp",
        destination: "/api/oauth/metadata/protected-resource",
      },
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/metadata/authorization-server",
      },
      {
        source: "/.well-known/oauth-authorization-server/api/mcp",
        destination: "/api/oauth/metadata/authorization-server",
      },
      {
        source: "/.well-known/openid-configuration",
        destination: "/api/oauth/metadata/authorization-server",
      },
    ]
  },
}

export default nextConfig
