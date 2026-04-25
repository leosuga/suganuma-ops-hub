import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"

// GET /api/agent/finance/summary?month=YYYY-MM
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7)
  const [year, mon] = month.split("-").map(Number)
  const from = `${year}-${String(mon).padStart(2, "0")}-01`
  const to = new Date(year, mon, 0).toISOString().slice(0, 10)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("transaction")
    .select("kind, amount")
    .eq("owner_id", ownerId)
    .gte("occurred_on", from)
    .lte("occurred_on", to)

  if (error) return serverError(error.message)

  const rows = (data ?? []) as Array<{ kind: string; amount: number }>
  const summary = rows.reduce(
    (acc, row) => {
      const amt = Number(row.amount)
      if (row.kind === "income") acc.income += amt
      else if (row.kind === "expense") acc.expense += amt
      else if (row.kind === "tax") acc.tax += amt
      return acc
    },
    { income: 0, expense: 0, tax: 0, month }
  )

  return NextResponse.json({ ...summary, balance: summary.income - summary.expense - summary.tax })
}
