import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const monthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Formato YYYY-MM"),
  target: z.number().positive().optional(),
})

// GET /api/agent/budget?month=YYYY-MM
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(month)) return badRequest("month deve ser YYYY-MM")

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("budget")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("month", month)
    .maybeSingle()

  if (error) return serverError(error.message)
  return NextResponse.json({ month, budget: data ?? null })
}

// POST /api/agent/budget — cria ou atualiza meta do mes
export async function POST(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const body = await req.json().catch(() => ({}))
  const parsed = monthSchema.safeParse(body)
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  const { month, target } = parsed.data
  if (target === undefined) return badRequest("target é obrigatório")

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from("budget")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("month", month)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from("budget")
      .update({ target, updated_at: new Date().toISOString() })
      .eq("id", (existing as { id: string }).id)
      .select("*")
      .single()
    if (error) return serverError(error.message)
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from("budget")
    .insert({ owner_id: ownerId, month, target })
    .select("*")
    .single()

  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}
