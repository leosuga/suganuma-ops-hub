import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const logSchema = z.object({
  kind: z.enum(["weight", "blood_pressure", "glucose", "heart_rate", "temperature", "other"]),
  value: z.record(z.string(), z.unknown()),
  logged_at: z.string().datetime().optional(),
})

// POST /api/agent/health/log
export async function POST(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const body = await req.json().catch(() => ({}))
  const parsed = logSchema.safeParse(body)
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("health_log")
    .insert({
      owner_id: ownerId,
      kind: parsed.data.kind,
      value: parsed.data.value,
      logged_at: parsed.data.logged_at ?? new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}
