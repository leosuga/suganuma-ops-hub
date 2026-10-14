import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, serverError } from "@/lib/agent-auth"
import { buildBabySnapshot } from "@/lib/baby/server"

// GET /api/agent/baby — idade, resumo de 24h (mamadas, fraldas, sono, vitamina D) e próximos cuidados
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  try {
    const snapshot = await buildBabySnapshot(ownerId)
    return NextResponse.json(snapshot ?? { child: null })
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined)
  }
}
