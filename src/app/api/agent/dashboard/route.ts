import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"

// GET /api/agent/dashboard — agregado cross-domain
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7)
  const [year, mon] = month.split("-").map(Number)
  const from = `${year}-${String(mon).padStart(2, "0")}-01`
  const to = new Date(year, mon, 0).toISOString().slice(0, 10)
  const now = new Date().toISOString()

  const supabase = createServiceClient()

  const [tasks, transactions, appointments, healthLogs] = await Promise.all([
    supabase
      .from("task")
      .select("status, priority")
      .eq("owner_id", ownerId)
      .neq("status", "archived"),
    supabase
      .from("transaction")
      .select("kind, amount")
      .eq("owner_id", ownerId)
      .gte("occurred_on", from)
      .lte("occurred_on", to),
    supabase
      .from("appointment")
      .select("id, title, starts_at, kind")
      .eq("owner_id", ownerId)
      .gte("starts_at", now)
      .order("starts_at")
      .limit(5),
    supabase
      .from("health_log")
      .select("kind, value, logged_at")
      .eq("owner_id", ownerId)
      .order("logged_at", { ascending: false })
      .limit(10),
  ])

  if (tasks.error) return serverError(tasks.error.message)
  if (transactions.error) return serverError(transactions.error.message)

  const taskData = (tasks.data ?? []) as Array<{ status: string; priority: string }>
  const taskSummary = taskData.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1
      if (t.priority === "urgent" && t.status !== "done") acc.urgent = (acc.urgent ?? 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  const txnData = (transactions.data ?? []) as Array<{ kind: string; amount: number }>
  const financeSummary = txnData.reduce(
    (acc, txn) => {
      const amt = Number(txn.amount)
      if (txn.kind === "income") acc.income += amt
      else if (txn.kind === "expense") acc.expense += amt
      else if (txn.kind === "tax") acc.tax += amt
      return acc
    },
    { income: 0, expense: 0, tax: 0 }
  )

  return NextResponse.json({
    month,
    tasks: taskSummary,
    finance: { ...financeSummary, balance: financeSummary.income - financeSummary.expense - financeSummary.tax },
    upcoming_appointments: appointments.data ?? [],
    recent_health_logs: healthLogs.data ?? [],
  })
}
