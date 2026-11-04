import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError, validateUuidParam } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { NOTE_COLUMNS } from "@/lib/db-columns"
import { syncNoteEmbeddingForOwner, deleteNoteEmbedding } from "@/lib/actions/semantic-search"
import { z } from "zod"

const updateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  pinned: z.boolean().optional(),
})

// PATCH /api/agent/notes/:id
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
    .from("note")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_id", ownerId)
    // Lista explícita, sem `search_vector` (tsvector da migration 0033 — payload
    // inútil que ia direto para o cliente MCP). Coluna nova em `note` precisa
    // ser adicionada em src/lib/db-columns.ts.
    .select(NOTE_COLUMNS)
    .single()

  if (error) return serverError(error.message)
  if (!data) return NextResponse.json({ error: "Não encontrado" }, { status: 404 })

  void syncNoteEmbeddingForOwner(data)

  return NextResponse.json(data)
}

// DELETE /api/agent/notes/:id
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const { id } = await params
  if (!validateUuidParam(id)) return badRequest("ID inválido")
  const supabase = createServiceClient()
  const { error } = await supabase
    .from("note")
    .delete()
    .eq("id", id)
    .eq("owner_id", ownerId)

  if (error) return serverError(error.message)

  void deleteNoteEmbedding(id)

  return new NextResponse(null, { status: 204 })
}
