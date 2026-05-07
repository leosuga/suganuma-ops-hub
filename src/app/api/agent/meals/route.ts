import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1).max(300),
  kind: z.string().default("recipe"),
  tags: z.array(z.string()).default([]),
  ingredients: z.array(z.string()).default([]),
  prep_time: z.number().int().optional(),
  notes: z.string().optional(),
})

// GET /api/agent/meals
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? "50"), 200)
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("meal")
    .select("*")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (error) return serverError(error.message)
  return NextResponse.json({ meals: data })
}

// POST /api/agent/meals
export async function POST(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("meal")
    .insert({ ...parsed.data, owner_id: ownerId })
    .select("*")
    .single()

  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}
