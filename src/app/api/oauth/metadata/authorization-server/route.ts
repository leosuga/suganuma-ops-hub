import { NextResponse } from "next/server"
import { authorizationServerMetadata } from "@/lib/oauth/config"

// RFC 8414 — Authorization Server Metadata.
// Servido em /.well-known/oauth-authorization-server (e openid-configuration,
// que alguns clientes sondam) via rewrite em next.config.ts.

export const dynamic = "force-dynamic"

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
}

export async function GET() {
  return NextResponse.json(authorizationServerMetadata(), {
    headers: { ...CORS, "Cache-Control": "public, max-age=300" },
  })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}
