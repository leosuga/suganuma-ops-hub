import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError, validateUuidParam } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"

const patchSchema = z.object({
  status: z.enum(["unprocessed", "triaged", "archived"]),
  triaged_at: z.string().datetime().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const { id } = await params
  if (!validateUuidParam(id)) return badRequest("ID inválido")

  const body = await req.json().catch(() => ({}))
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) return badRequest(JSON.stringify(parsed.error.flatten().fieldErrors))

  const updates: Record<string, unknown> = { status: parsed.data.status }
  if (parsed.data.status === "triaged" && !parsed.data.triaged_at) {
    updates.triaged_at = new Date().toISOString()
  } else if (parsed.data.triaged_at) {
    updates.triaged_at = parsed.data.triaged_at
  }

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("inbox_item")
    .update(updates)
    .eq("id", id)
    .eq("owner_id", ownerId)
    .select("*")
    .single()

  if (error) return serverError(error.message)
  if (!data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const { id } = await params
  if (!validateUuidParam(id)) return badRequest("ID inválido")
  const supabase = createServiceClient()
  const { error } = await supabase
    .from("inbox_item")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId)

  if (error) return serverError(error.message)
  return new NextResponse(null, { status: 204 })
}