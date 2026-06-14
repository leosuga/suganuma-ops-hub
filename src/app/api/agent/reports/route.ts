import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"

// GET /api/agent/reports
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const supabase = createServiceClient()

  const [t, tr, h, e] = await Promise.all([
    supabase
      .from("task")
      .select("id, completed_at, due_at, created_at, status, priority")
      .eq("owner_id", ownerId)
      .neq("status", "archived"),
    supabase
      .from("transaction")
      .select("id, kind, amount, occurred_on")
      .eq("owner_id", ownerId),
    supabase
      .from("habit_track")
      .select("id, name, active, created_at")
      .eq("owner_id", ownerId),
    supabase
      .from("habit_entry")
      .select("habit_id, done_on")
      .limit(500),
  ])

  if (t.error) return serverError(t.error.message)
  if (tr.error) return serverError(tr.error.message)
  if (h.error) return serverError(h.error.message)
  if (e.error) return serverError(e.error.message)

  const tasks = (t.data ?? []) as Array<{
    id: string
    status: string
    priority: string
    completed_at: string | null
    due_at: string | null
    created_at: string
  }>

  const now = new Date().toISOString()
  const taskSummary = tasks.reduce(
    (acc, task) => {
      acc.total += 1
      acc[task.status] = (acc[task.status] as number) + 1
      if (task.status === "done") acc.completed += 1
      if (task.status !== "done" && task.due_at && task.due_at < now) acc.overdue += 1
      if (task.priority === "urgent" && task.status !== "done") acc.urgent += 1
      return acc
    },
    { total: 0, todo: 0, doing: 0, done: 0, completed: 0, overdue: 0, urgent: 0 } as Record<string, number>
  )

  const transactions = (tr.data ?? []) as Array<{ kind: string; amount: number; occurred_on: string }>
  const currentMonth = new Date().toISOString().slice(0, 7)
  const monthly = transactions.reduce(
    (acc, txn) => {
      const month = txn.occurred_on.slice(0, 7)
      if (!acc[month]) acc[month] = { income: 0, expense: 0, tax: 0 }
      if (txn.kind === "income") acc[month].income += txn.amount
      else if (txn.kind === "expense") acc[month].expense += txn.amount
      else if (txn.kind === "tax") acc[month].tax += txn.amount
      return acc
    },
    {} as Record<string, { income: number; expense: number; tax: number }>
  )

  return NextResponse.json({
    tasks: taskSummary,
    finance_monthly: monthly,
    finance_current_month: monthly[currentMonth] ?? { income: 0, expense: 0, tax: 0 },
    habits: h.data ?? [],
    habit_entries_sample: e.data ?? [],
  })
}
