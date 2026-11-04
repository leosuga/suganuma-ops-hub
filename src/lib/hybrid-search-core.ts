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
 * Diagnóstico das duas pernas da busca. Aditivo ao contrato `{ ok, results }`:
 * não é devolvido por nenhuma rota HTTP, existe para o log e para os testes
 * distinguirem "não achou nada" de "a perna falhou em silêncio".
 */
export interface HybridSearchDebug {
  /** A perna FTS (Postgres) respondeu sem erro. */
  fts_ok: boolean
  /** A perna vetorial (Ollama + Qdrant) respondeu sem erro. */
  vector_ok: boolean
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

    // Query vazia: nada foi executado, então nenhuma perna falhou.
    if (!query.trim()) {
      return {
        ok: true,
        results: [] as SearchResult[],
        debug: { fts_ok: true, vector_ok: true } satisfies HybridSearchDebug,
      }
    }

    const q = query.trim()
    const fetchLimit = Math.max(limit * 2, 20)

    // Vetorial (Qdrant) e FTS (Postgres) são independentes — rodar em paralelo
    // corta a latência combinada quase pela metade em vez de somar as duas.
    const [vectorOutcome, ftsOutcome] = await Promise.allSettled([
      (async () => {
        const embedding = await embedText(q)
        await ensureCollection()
        const raw = await searchNotes(ownerId, embedding, fetchLimit, 0.5)
        return raw.map((r) => ({ id: r.id, score: r.score }))
      })(),
      supabase
        .from("note")
        .select("id, title, content, tags, para, is_moc, project_id, pinned, updated_at")
        .eq("owner_id", ownerId)
        // type: "websearch" → websearch_to_tsquery. Sem o `type` o PostgREST usa
        // o operador `fts`, que vira to_tsquery('portuguese', 'data drift') e
        // ERRA na sintaxe (espaço nu não é operador): toda query de 2+ palavras
        // perdia a perna FTS em silêncio, e a busca ficava só vetorial.
        .textSearch("search_vector", q, { config: "portuguese", type: "websearch" })
        .limit(fetchLimit)
        .then(({ data, error }) => {
          if (error) throw error
          return data ?? []
        }),
    ])

    const debug: HybridSearchDebug = {
      vector_ok: vectorOutcome.status === "fulfilled",
      fts_ok: ftsOutcome.status === "fulfilled",
    }

    let vectorResults: Array<{ id: string; score: number }> = []
    if (vectorOutcome.status === "fulfilled") {
      vectorResults = vectorOutcome.value
    } else {
      logger.warn("hybridSearchCore", "Vector search failed (non-blocking)", {
        query: q,
        error: errorMessage(vectorOutcome.reason),
      })
    }

    let ftsResults: Array<{ id: string; title: string; content: string | null; tags: string[] | null; para: string | null; is_moc: boolean | null; project_id: string | null; pinned: boolean | null; updated_at: string }> = []
    if (ftsOutcome.status === "fulfilled") {
      ftsResults = ftsOutcome.value
    } else {
      // Com a query no log, uma falha de sintaxe do tsquery deixa de ser
      // indistinguível de "não achou nada".
      logger.warn("hybridSearchCore", "FTS search failed (non-blocking)", {
        query: q,
        error: errorMessage(ftsOutcome.reason),
      })
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

    if (rrfScores.size === 0) {
      logger.info("hybridSearchCore", "no hits from either leg", { query: q, ...debug })
      return { ok: true, results: [] as SearchResult[], debug }
    }

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

    logger.info("hybridSearchCore", "search done", {
      query: q,
      results: results.length,
      ...debug,
    })

    return { ok: true, results, debug }
  } catch (err) {
    logger.error("hybridSearchCore", "Failed", { query, error: (err as Error).message })
    return {
      ok: false,
      error: (err as Error).message,
      results: [] as SearchResult[],
      debug: { fts_ok: false, vector_ok: false } satisfies HybridSearchDebug,
    }
  }
}

/** Mensagem de um `reason` de Promise.allSettled — pode ser qualquer coisa. */
function errorMessage(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  if (typeof reason === "string") return reason
  // Erros do PostgREST não são `Error`: são objetos { message, details, code }.
  if (reason && typeof reason === "object" && "message" in reason) {
    const message = (reason as { message: unknown }).message
    if (typeof message === "string") return message
  }
  try {
    return JSON.stringify(reason)
  } catch {
    return String(reason)
  }
}
