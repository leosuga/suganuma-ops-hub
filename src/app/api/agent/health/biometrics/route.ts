import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, serverError, validateHealthKind, validateIsoDateTime, parseLimitParam } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"

// GET /api/agent/health/biometrics?kind=&since=&limit=
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const { searchParams } = req.nextUrl
  const kind = validateHealthKind(searchParams.get("kind"))
  const since = validateIsoDateTime(searchParams.get("since"))
  const limit = parseLimitParam(searchParams.get("limit"), 100, 500)

  const supabase = createServiceClient()
  let query = supabase
    .from("health_log")
    .select("*")
    .eq("owner_id", ownerId)
    .order("logged_at", { ascending: false })
    .limit(limit)

  if (kind) query = query.eq("kind", kind)
  if (since) query = query.gte("logged_at", since)

  const { data, error } = await query
  if (error) return serverError(error.message)
  return NextResponse.json({ logs: data })
}
