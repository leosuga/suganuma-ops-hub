import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError } from "@/lib/agent-auth"
import { semanticSearchNotes } from "@/lib/actions/semantic-search"
import { z } from "zod"

const querySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.coerce.number().int().min(1).max(50).default(10),
})

// GET /api/agent/search/notes?q=&limit=
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const { searchParams } = req.nextUrl
  const parsed = querySchema.safeParse({
    q: searchParams.get("q"),
    limit: searchParams.get("limit") ?? "10",
  })
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  const { q, limit } = parsed.data

  try {
    const results = await semanticSearchNotes(q, limit)
    return NextResponse.json({ query: q, results })
  } catch (err) {
    return serverError(err instanceof Error ? err.message : "Erro na busca semântica")
  }
}
