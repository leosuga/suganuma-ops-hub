import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const createSchema = z.object({
  kind: z.enum(["income", "expense", "transfer", "tax"]),
  amount: z.number().positive(),
  category: z.string().optional(),
  description: z.string().optional(),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  account_id: z.string().uuid().optional(),
  currency: z.string().length(3).default("BRL"),
})

// POST /api/agent/finance/transactions
export async function POST(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const body = await req.json().catch(() => ({}))
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  const supabase = createServiceClient()

  // account_id não é validado contra o dono por padrão nas FKs — sem isso, um
  // account_id de outro owner é aceito silenciosamente na criação.
  if (parsed.data.account_id) {
    const { data: account } = await supabase
      .from("account")
      .select("id")
      .eq("id", parsed.data.account_id)
      .eq("owner_id", ownerId)
      .maybeSingle()
    if (!account) return badRequest("account_id não encontrado")
  }

  const { data, error } = await supabase
    .from("transaction")
    .insert({ ...parsed.data, owner_id: ownerId })
    .select("*")
    .single()

  if (error) return serverError(error.message)
  return NextResponse.json(data, { status: 201 })
}
