"use server"

import { embedText } from "@/lib/ollama"
import { ensureCollection, upsertNoteVector, deleteNoteVector, searchNotes } from "@/lib/qdrant"
import { createClient } from "@/lib/supabase/server"
import { logger } from "@/lib/logger"

/**
 * Núcleo do sync de embedding — sem lookup de sessão, o chamador já garante o
 * dono da nota. Compartilhado entre a Server Action (sessão via cookie) e as
 * rotas de agente (Bearer token, sem cookie de sessão).
 */
async function syncNoteEmbeddingCore(note: { id: string; title: string; content: string | null; owner_id: string }) {
  const textToEmbed = `${note.title}\n\n${note.content || ""}`.trim()
  if (!textToEmbed) {
    // Delete if empty
    await deleteNoteVector(note.id).catch(() => null)
    return { ok: true }
  }

  const embedding = await embedText(textToEmbed)

  await ensureCollection()
  await upsertNoteVector(note.id, note.owner_id, embedding, {
    title: note.title,
    content_preview: (note.content || "").slice(0, 200),
  })

  return { ok: true }
}

/**
 * Sync a note's embedding to Qdrant.
 * Called after note create or update (from client mutation onSuccess).
 */
export async function syncNoteEmbedding(noteId: string) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    // Fetch note
    const { data: note, error } = await supabase
      .from("note")
      .select("id, title, content, owner_id")
      .eq("id", noteId)
      .eq("owner_id", user.id)
      .single()
    if (error || !note) throw new Error("Note not found")

    return await syncNoteEmbeddingCore(note)
  } catch (err) {
    logger.error("syncNoteEmbedding", "Failed", { noteId, error: (err as Error).message })
    return { ok: false, error: (err as Error).message }
  }
}

/**
 * Mesma sincronização, para chamadores que já têm a nota e o dono verificados
 * fora de uma sessão de cookie (rotas de agente/MCP, autenticadas por Bearer).
 */
export async function syncNoteEmbeddingForOwner(note: {
  id: string
  title: string
  content: string | null
  owner_id: string
}) {
  try {
    return await syncNoteEmbeddingCore(note)
  } catch (err) {
    logger.error("syncNoteEmbeddingForOwner", "Failed", { noteId: note.id, error: (err as Error).message })
    return { ok: false, error: (err as Error).message }
  }
}

/**
 * Delete a note's embedding from Qdrant.
 */
export async function deleteNoteEmbedding(noteId: string) {
  try {
    await deleteNoteVector(noteId)
    return { ok: true }
  } catch (err) {
    logger.error("deleteNoteEmbedding", "Failed", { noteId, error: (err as Error).message })
    return { ok: false, error: (err as Error).message }
  }
}

/**
 * Semantic search over user's notes.
 */
export async function semanticSearchNotes(query: string, limit: number = 10) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error("Not authenticated")

    if (!query.trim()) return { ok: true, results: [] }

    const embedding = await embedText(query.trim())
    await ensureCollection()
    const results = await searchNotes(user.id, embedding, limit, 0.65)

    // Fetch full note data from Supabase for the returned IDs
    const noteIds = results.map((r) => r.id)
    if (noteIds.length === 0) return { ok: true, results: [] }

    const { data: notes, error } = await supabase
      .from("note")
      .select("id, title, content, tags, para, is_moc, project_id, pinned, updated_at")
      .in("id", noteIds)
      .eq("owner_id", user.id)
    if (error) throw error

    // Order by Qdrant relevance (scores)
    const notesById = new Map(notes?.map((n) => [n.id, n]) ?? [])
    const ordered = results
      .map((r) => {
        const note = notesById.get(r.id)
        if (!note) return null
        return { ...note, score: r.score }
      })
      .filter(Boolean)

    return { ok: true, results: ordered }
  } catch (err) {
    logger.error("semanticSearchNotes", "Failed", { query, error: (err as Error).message })
    return { ok: false, error: (err as Error).message, results: [] }
  }
}
