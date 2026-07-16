import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError, validateIsoDateTime } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"

// GET /api/agent/calendar?from=ISO&to=ISO
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const { searchParams } = req.nextUrl
  const from = searchParams.get("from")
  const to = searchParams.get("to")

  if (!from || !to) return badRequest("from e to são obrigatórios (ISO datetime)")
  const validFrom = validateIsoDateTime(from)
  const validTo = validateIsoDateTime(to)
  if (!validFrom || !validTo) return badRequest("from e to devem ser ISO datetime válidos")

  const supabase = createServiceClient()

  const [appointments, tasks, mealPlans] = await Promise.all([
    supabase
      .from("appointment")
      .select("id, title, starts_at, kind, location")
      .eq("owner_id", ownerId)
      .gte("starts_at", validFrom)
      .lte("starts_at", validTo)
      .order("starts_at", { ascending: true }),
    supabase
      .from("task")
      .select("id, title, due_at, priority, status, category")
      .eq("owner_id", ownerId)
      .in("status", ["todo", "doing"])
      .not("due_at", "is", null)
      .gte("due_at", validFrom)
      .lte("due_at", validTo)
      .order("due_at", { ascending: true }),
    supabase
      .from("meal_plan")
      .select("id, date, meal_type, meal_id, meal:meal_id (id, name, kind, tags)")
      .eq("owner_id", ownerId)
      .gte("date", validFrom.slice(0, 10))
      .lte("date", validTo.slice(0, 10))
      .order("date", { ascending: true }),
  ])

  if (appointments.error) return serverError(appointments.error.message)
  if (tasks.error) return serverError(tasks.error.message)
  if (mealPlans.error) return serverError(mealPlans.error.message)

  return NextResponse.json({
    from: validFrom,
    to: validTo,
    appointments: appointments.data ?? [],
    tasks: tasks.data ?? [],
    mealPlans: mealPlans.data ?? [],
  })
}
