import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"

// POST /api/agent/tasks/:id/complete
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const { id } = await params
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("task")
    .update({ status: "done", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .single()

  if (error) return serverError(error.message)
  if (!data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  return NextResponse.json(data)
}
