import { embedText } from "@/lib/ollama"
import { ensureCollection, searchNotes } from "@/lib/qdrant"
import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logger"

const RRF_K = 60

export interface SearchResult {
  id: string
  title: string
  content: string | null
  tags: string[] | null
  para: string | null
  is_moc: boolean | null
  project_id: string | null
  pinned: boolean | null
  updated_at: string
  score: number
  source: "vector" | "fts" | "hybrid"
}

/**
 * Núcleo da busca híbrida, parametrizado por ownerId.
 *
 * Este módulo NÃO tem "use server" de propósito: em arquivo de server action
 * todo export vira endpoint HTTP, e uma função que recebe ownerId permitiria
 * um cliente ler notas de outro usuário. Chamar apenas de contextos que já
 * autenticaram o dono (server action com sessão, ou rota /api/agent com token).
 *
 * Usa service client (sem RLS) — o escopo por dono é garantido pelo filtro
 * explícito .eq("owner_id", ownerId) em toda query.
 *
 * Combina Qdrant (similaridade vetorial) com PostgreSQL FTS (tsvector) via
 * Reciprocal Rank Fusion: score = Σ 1/(k + rank_i), k=60, rank 1-indexed.
 */
export async function hybridSearchCore(ownerId: string, query: string, limit: number = 10) {
  try {
    const supabase = createServiceClient()

    if (!query.trim()) return { ok: true, results: [] as SearchResult[] }

    const q = query.trim()
    const fetchLimit = Math.max(limit * 2, 20)

    // 1. Vector search via Qdrant (semantic similarity)
    let vectorResults: Array<{ id: string; score: number }> = []
    try {
      const embedding = await embedText(q)
      await ensureCollection()
      const raw = await searchNotes(ownerId, embedding, fetchLimit, 0.5)
      vectorResults = raw.map((r) => ({ id: r.id, score: r.score }))
    } catch (err) {
      logger.warn("hybridSearchCore", "Vector search failed (non-blocking)", { error: (err as Error).message })
    }

    // 2. FTS via PostgreSQL (keyword match, BM25-like ranking via ts_rank)
    let ftsResults: Array<{ id: string; title: string; content: string | null; tags: string[] | null; para: string | null; is_moc: boolean | null; project_id: string | null; pinned: boolean | null; updated_at: string }> = []
    try {
      const { data, error } = await supabase
        .from("note")
        .select("id, title, content, tags, para, is_moc, project_id, pinned, updated_at")
        .eq("owner_id", ownerId)
        .textSearch("search_vector", q, { config: "portuguese" })
        .limit(fetchLimit)

      if (error) throw error
      ftsResults = data ?? []
    } catch (err) {
      logger.warn("hybridSearchCore", "FTS search failed (non-blocking)", { error: (err as Error).message })
    }

    // 3. RRF merge
    const rrfScores = new Map<string, { score: number; sources: Set<string> }>()

    vectorResults.forEach((r, i) => {
      const existing = rrfScores.get(r.id)
      const rrf = 1 / (RRF_K + i + 1)
      if (existing) {
        existing.score += rrf
        existing.sources.add("vector")
      } else {
        rrfScores.set(r.id, { score: rrf, sources: new Set(["vector"]) })
      }
    })

    ftsResults.forEach((r, i) => {
      const existing = rrfScores.get(r.id)
      const rrf = 1 / (RRF_K + i + 1)
      if (existing) {
        existing.score += rrf
        existing.sources.add("fts")
      } else {
        rrfScores.set(r.id, { score: rrf, sources: new Set(["fts"]) })
      }
    })

    if (rrfScores.size === 0) return { ok: true, results: [] as SearchResult[] }

    // 4. Fetch full note data for vector-only results (FTS results already have it)
    const ftsIds = new Set(ftsResults.map((r) => r.id))
    const vectorOnlyIds = vectorResults.map((r) => r.id).filter((id) => !ftsIds.has(id))

    let vectorNotes: Array<typeof ftsResults[0]> = []
    if (vectorOnlyIds.length > 0) {
      const { data, error } = await supabase
        .from("note")
        .select("id, title, content, tags, para, is_moc, project_id, pinned, updated_at")
        .in("id", vectorOnlyIds)
        .eq("owner_id", ownerId)
      if (!error && data) vectorNotes = data
    }

    // 5. Build result list
    const allNotes = new Map<string, typeof ftsResults[0]>()
    for (const n of ftsResults) allNotes.set(n.id, n)
    for (const n of vectorNotes) allNotes.set(n.id, n)

    const results: SearchResult[] = Array.from(rrfScores.entries())
      .map(([id, { score, sources }]) => {
        const note = allNotes.get(id)
        if (!note) return null
        const source = sources.size === 2 ? "hybrid" : (sources.has("vector") ? "vector" : "fts")
        return {
          ...note,
          score: Math.round(score * 10000) / 10000,
          source,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, limit) as SearchResult[]

    return { ok: true, results }
  } catch (err) {
    logger.error("hybridSearchCore", "Failed", { query, error: (err as Error).message })
    return { ok: false, error: (err as Error).message, results: [] as SearchResult[] }
  }
}
