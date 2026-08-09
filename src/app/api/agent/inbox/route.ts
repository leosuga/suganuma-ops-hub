import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError, parseLimitParam } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const createSchema = z.object({
  content: z.string().min(1).max(5000),
  source: z.enum(["manual", "telegram", "audio", "email", "webhook", "mcp"]).default("mcp"),
  ai_payload: z.record(z.unknown()).optional().nullable(),
})

export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const status = req.nextUrl.searchParams.get("status") ?? "unprocessed"
  const limit = parseLimitParam(req.nextUrl.searchParams.get("limit"), "50", 200)

  const supabase = createServiceClient()
  let q = supabase
    .from("inbox_item")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (status !== "all") {
    q = q.eq("status", status)
  }

  const { data, error } = await q
  if (error) return serverError(error.message)
  return NextResponse.json({ items: data })
}

export async function POST(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("inbox_item")
    .insert({ ...parsed.data, owner_id: ownerId })
    .select("*")
    .single()

  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}