import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, serverError, badRequest, validateUuidParam } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { TASK_COLUMNS } from "@/lib/db-columns"

// POST /api/agent/tasks/:id/complete
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const { id } = await params
  if (!validateUuidParam(id)) return badRequest("ID inválido")
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("task")
    .update({ status: "done", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", ownerId)
    // Lista explícita, sem `search_vector` (tsvector da migration 0033 — payload
    // inútil que ia direto para o cliente MCP). Coluna nova em `task` precisa
    // ser adicionada em src/lib/db-columns.ts.
    .select(TASK_COLUMNS)
    .single()

  if (error) return serverError(error.message)
  if (!data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  return NextResponse.json(data)
}
