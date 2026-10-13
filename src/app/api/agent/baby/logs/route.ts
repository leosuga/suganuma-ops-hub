import { NextRequest, NextResponse } from "next/server"
import {
  validateAgentToken,
  unauthorized,
  badRequest,
  serverError,
  validateIsoDateTime,
  parseLimitParam,
} from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { fetchOwnerChild } from "@/lib/baby/server"
import { normalizeAgentLog } from "@/lib/baby/agent"
import { babyLogKindSchema } from "@/lib/schemas/baby"

// GET /api/agent/baby/logs?kind=&since=&limit=
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const { searchParams } = req.nextUrl
  const kindParam = searchParams.get("kind")
  const kind = kindParam && babyLogKindSchema.safeParse(kindParam).success ? kindParam : null
  const since = validateIsoDateTime(searchParams.get("since"))
  const limit = parseLimitParam(searchParams.get("limit"), 50, 500)

  try {
    const child = await fetchOwnerChild(ownerId)
    if (!child) return NextResponse.json({ logs: [] })

    const supabase = createServiceClient()
    let query = supabase
      .from("baby_log")
      .select("*")
      .eq("owner_id", ownerId)
      .eq("child_id", child.id)
      .order("started_at", { ascending: false })
      .limit(limit)
    if (kind) query = query.eq("kind", kind)
    if (since) query = query.gte("started_at", since)

    const { data, error } = await query
    if (error) return serverError(error.message)
    return NextResponse.json({ logs: data })
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined)
  }
}

// POST /api/agent/baby/logs — registra mamada, fralda, sono, remédio, medida, temperatura ou nota
export async function POST(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  try {
    const child = await fetchOwnerChild(ownerId)
    if (!child) return badRequest("Nenhuma criança cadastrada. Cadastre a bebê em /baby primeiro.")

    const body = await req.json().catch(() => null)
    const parsed = normalizeAgentLog(body, child.id)
    if (!parsed.success) return badRequest(parsed.error)

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from("baby_log")
      .insert({ ...parsed.data, owner_id: ownerId })
      .select("*")
      .single()
    if (error) return serverError(error.message)
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return serverError(err instanceof Error ? err.message : undefined)
  }
}
