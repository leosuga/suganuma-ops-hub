import type { NextConfig } from "next"

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // CSP movida para o middleware (src/middleware.ts) com nonce + 'strict-dynamic'
  // para páginas dinâmicas — doc oficial do Next 16. Headers duplicados aqui
  // causariam interseção de políticas (quebra os scripts com nonce).
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
