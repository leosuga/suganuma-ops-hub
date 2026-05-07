import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1).max(200),
  active: z.boolean().default(true),
})

// GET /api/agent/habits
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50"), 200)
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("habit_track")
    .select("*")
    .eq("owner_id", ownerId)
    .order("active", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(limit)

  if (error) return serverError(error.message)
  return NextResponse.json({ habits: data })
}

// POST /api/agent/habits
export async function POST(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("habit_track")
    .insert({ ...parsed.data, owner_id: ownerId })
    .select("*")
    .single()

  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}
