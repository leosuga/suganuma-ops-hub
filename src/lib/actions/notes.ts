// Criação de nota compartilhada entre rotas de agente e integrações.
//
// Centraliza o insert + sync de embedding para que QUALQUER chamador server-side
// (rota /api/agent/notes, endpoint de integração do Raindrop, etc.) crie notas
// que entram no índice vetorial — sem reintroduzir o bug de "nota criada fora
// da UI não aparece na busca semântica" (ver docs/backlog-2026-08.md, item 3).

import { createServiceClient } from "@/lib/supabase/service"
import { syncNoteEmbeddingForOwner } from "@/lib/actions/semantic-search"

export interface CreateNoteInput {
  title: string
  content?: string
  tags?: string[]
  pinned?: boolean
  para?: "projects" | "areas" | "resources" | "archive" | null
}

/**
 * Insere uma nota via service role (sem RLS) e dispara o sync de embedding
 * fire-and-forget. Lança em caso de erro de insert.
 */
export async function createNoteWithEmbedding(ownerId: string, input: CreateNoteInput) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("note")
    .insert({ ...input, owner_id: ownerId })
    .select("*")
    .single()

  if (error) throw new Error(error.message)

  void syncNoteEmbeddingForOwner(data)
  return data
}
