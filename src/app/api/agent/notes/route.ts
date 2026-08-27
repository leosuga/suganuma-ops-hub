import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { createNoteWithEmbedding } from "@/lib/actions/notes"
import { z } from "zod"

const createSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional(),
  tags: z.array(z.string()).default([]),
  pinned: z.boolean().default(false),
})

// GET /api/agent/notes
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50"), 200)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("note")
    .select("*")
    .eq("owner_id", ownerId)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) return serverError(error.message)
  return NextResponse.json({ notes: data })
}

// POST /api/agent/notes
export async function POST(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  try {
    const data = await createNoteWithEmbedding(ownerId, parsed.data)
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return serverError((err as Error).message)
  }
}
