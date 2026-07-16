import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, badRequest, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"
import { z } from "zod"
import { parseTitle } from "@/lib/parse-title"

const parseBodySchema = z.object({
  title: z.string().min(1).max(500),
  notes: z.string().optional(),
})

// POST /api/agent/tasks/parse
// Cria task usando o parser inteligente do QuickAdd (projetos, categoria, prioridade, due_at, tags, delegado, recorrência, importante)
export async function POST(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const body = await req.json().catch(() => ({}))
  const parsedBody = parseBodySchema.safeParse(body)
  if (!parsedBody.success) return badRequest(JSON.stringify(parsedBody.error.flatten().fieldErrors))
  const raw = parsedBody.data.title

  const supabase = createServiceClient()

  // Fetch projects for parser matching
  const { data: projects } = await supabase
    .from("project")
    .select("id, name")
    .eq("owner_id", ownerId)
    .eq("status", "active")

  const parsed = parseTitle(raw, (projects ?? []) as Array<{ id: string; name: string }>)

  const { data, error } = await supabase
    .from("task")
    .insert({
      owner_id: ownerId,
      title: parsed.title,
      notes: parsedBody.data.notes ?? parsed.notes ?? "",
      category: parsed.category ?? "personal",
      priority: parsed.priority ?? "med",
      due_at: parsed.due_at ?? null,
      project_id: parsed.project_id ?? null,
      delegated_to: parsed.delegated_to ?? null,
      important: parsed.important ?? false,
      recurrence: parsed.recurrence ?? null,
      tags: parsed.tags ?? null,
    })
    .select("*")
    .single()

  if (error) return serverError(error.message)
  return NextResponse.json({ parsed, task: data }, { status: 201 })
}
