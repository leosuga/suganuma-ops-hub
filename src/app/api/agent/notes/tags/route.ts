import { NextRequest, NextResponse } from "next/server"
import { validateAgentToken, unauthorized, serverError } from "@/lib/agent-auth"
import { createServiceClient } from "@/lib/supabase/service"

// GET /api/agent/notes/tags
export async function GET(req: NextRequest) {
  let ownerId: string
  try { ownerId = await validateAgentToken(req) } catch { return unauthorized() }

  const supabase = createServiceClient()
  const { data, error } = await supabase.rpc("get_note_tags", { p_owner_id: ownerId })

  if (error) {
    // fallback: scan raw tags if RPC not available
    const { data: notes, error: notesError } = await supabase
      .from("note")
      .select("tags")
      .eq("owner_id", ownerId)
    if (notesError) return serverError(notesError.message)

    const tagSet = new Set<string>()
    for (const note of notes ?? []) {
      for (const tag of (note.tags ?? []) as string[]) {
        tagSet.add(tag)
      }
    }
    return NextResponse.json({ tags: Array.from(tagSet).sort() })
  }

  return NextResponse.json({ tags: data ?? [] })
}
