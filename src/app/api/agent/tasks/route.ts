import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const createSchema = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().optional(),
  category: z.enum(["finance", "logistics", "personal", "health"]).default("personal"),
  priority: z.enum(["low", "med", "high", "urgent"]).default("med"),
  due_at: z.string().datetime().optional(),
})

// GET /api/agent/tasks?status=&priority=&limit=
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const { searchParams } = req.nextUrl
  const status = searchParams.get("status")
  const priority = searchParams.get("priority")
  const limit = Math.min(Number(searchParams.get("limit") ?? "50"), 200)

  const supabase = createServiceClient()
  let query = supabase
    .from("task")
    .select("*")
    .eq("owner_id", ownerId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(limit)

  if (status) query = query.eq("status", status)
  if (priority) query = query.eq("priority", priority)

  const { data, error } = await query
  if (error) return serverError(error.message)
  return NextResponse.json({ tasks: data })
}

// POST /api/agent/tasks
export async function POST(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("task")
    .insert({ ...parsed.data, owner_id: ownerId })
    .select("*")
    .single()

  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}
