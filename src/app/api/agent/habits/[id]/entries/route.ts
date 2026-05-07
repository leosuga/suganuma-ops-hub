import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const entrySchema = z.object({
  done_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  notes: z.string().optional(),
})

// GET /api/agent/habits/:id/entries
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const { id } = await params
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "90"), 500)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("habit_entry")
    .select("*")
    .eq("habit_id", id)
    .order("done_on", { ascending: false })
    .limit(limit)

  if (error) return serverError(error.message)
  return NextResponse.json({ entries: data })
}

// POST /api/agent/habits/:id/entries
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const parsed = entrySchema.safeParse(body)
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  // Verify habit belongs to owner
  const supabase = createServiceClient()
  const { data: habit } = await supabase
    .from("habit_track")
    .select("id")
    .eq("id", id)
    .eq("owner_id", ownerId)
    .single()

  if (!habit) return NextResponse.json({ error: "Hábito não encontrado" }, { status: 404 })

  const { data, error } = await supabase
    .from("habit_entry")
    .insert({ ...parsed.data, habit_id: id })
    .select("*")
    .single()

  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}
