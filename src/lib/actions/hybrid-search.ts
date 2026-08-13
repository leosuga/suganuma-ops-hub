"use server"

import { createClient } from "@/lib/supabase/server"
import { hybridSearchCore } from "@/lib/hybrid-search-core"
import { logger } from "@/lib/logger"
import type { SearchResult } from "@/lib/hybrid-search-core"

export type { SearchResult }

/**
 * Busca híbrida para a UI: resolve o dono pela sessão (cookie) e delega ao núcleo.
 *
 * A lógica vive em @/lib/hybrid-search-core, que NÃO é server action — ver o
 * comentário lá sobre por que uma função com ownerId não pode ser exportada
 * de um arquivo "use server".
 */
export async function hybridSearchNotes(query: string, limit: number = 10) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    logger.error("hybridSearchNotes", "Failed", { query, error: "Not authenticated" })
    return { ok: false, error: "Not authenticated", results: [] as SearchResult[] }
  }

  return hybridSearchCore(user.id, query, limit)
}
