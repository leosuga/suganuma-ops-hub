import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const planSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  meal_id: z.string().uuid().nullable().optional(),
  notes: z.string().optional(),
})

// GET /api/agent/meals/plans?week_start=YYYY-MM-DD
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const weekStart = req.nextUrl.searchParams.get("week_start")
  if (!weekStart) return badRequest("week_start é obrigatório (YYYY-MM-DD)")

  const endDate = new Date(weekStart)
  endDate.setDate(endDate.getDate() + 7)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("meal_plan")
    .select("*")
    .eq("owner_id", ownerId)
    .gte("date", weekStart)
    .lt("date", endDate.toISOString().slice(0, 10))
    .order("date", { ascending: true })

  if (error) return serverError(error.message)
  return NextResponse.json({ plans: data })
}

// POST /api/agent/meals/plans — upsert: atualiza se já existe para mesma data+tipo
export async function POST(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const body = await req.json().catch(() => ({}))
  const parsed = planSchema.safeParse(body)
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  const supabase = createServiceClient()

  const { data: existing } = await supabase
    .from("meal_plan")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("date", parsed.data.date)
    .eq("meal_type", parsed.data.meal_type)
    .maybeSingle()

  if (existing) {
    const { data, error } = await supabase
      .from("meal_plan")
      .update({
        meal_id: parsed.data.meal_id ?? null,
        notes: parsed.data.notes ?? null,
      })
      .eq("id", existing.id)
      .select("*")
      .single()
    if (error) return serverError(error.message)
    return NextResponse.json(data)
  }

  const { data, error } = await supabase
    .from("meal_plan")
    .insert({ ...parsed.data, owner_id: ownerId })
    .select("*")
    .single()

  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}
