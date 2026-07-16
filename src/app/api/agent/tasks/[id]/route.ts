import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError, validateUuidParam } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  notes: z.string().nullable().optional(),
  category: z.enum(["finance", "logistics", "personal", "health"]).optional(),
  status: z.enum(["todo", "doing", "done", "archived"]).optional(),
  priority: z.enum(["low", "med", "high", "urgent"]).optional(),
  due_at: z.string().datetime().nullable().optional(),
})

// PATCH /api/agent/tasks/:id
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const body = await req.json().catch(() => ({}))
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  const { id } = await params
  if (!validateUuidParam(id)) return badRequest("ID inválido")
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("task")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .single()

  if (error) return serverError(error.message)
  if (!data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  return NextResponse.json(data)
}
