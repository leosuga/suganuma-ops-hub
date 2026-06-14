import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"

// GET /api/agent/accounts
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("account")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: true })

  if (error) return serverError(error.message)
  return NextResponse.json({ accounts: data })
}
