import { NextResponse } from "next/server"
import { protectedResourceMetadata } from "@/lib/oauth/config"

// RFC 9728 — Protected Resource Metadata.
// Servido em /.well-known/oauth-protected-resource e na variante com sufixo
// /.well-known/oauth-protected-resource/api/mcp via rewrite (next.config.ts).

export const dynamic = "force-dynamic"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
}

export async function GET() {
  return NextResponse.json(protectedResourceMetadata(), {
    headers: { ...CORS, "Cache-Control": "public, max-age=300" },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
