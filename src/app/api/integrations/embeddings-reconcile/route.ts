// POST /api/integrations/embeddings-reconcile
//
// Reconciliação de embeddings: o sync fire-and-forget (`syncNoteEmbedding`
// no onSettled das mutations) pode falhar silenciosamente — nota fica fora
// do índice vetorial e a busca semântica nunca a encontra. Este job varre
// todas as notas, compara o hash do conteúdo com o payload do ponto no
// Qdrant e re-sync só o que divergiu (ou não existe).
//
// Auth: HMAC com EMBEDDINGS_RECONCILE_SECRET (secret dedicado, mesmo padrão
// do raindrop-sync). Payload pode trazer `{ "owner_id": "<uuid>!" }` — o
// "!" pula o modo dry-run. Sem owner_id: reconcilia o WEBHOOK_OWNER_ID.
//
// Custo controlado: 1 scroll de Qdrant + 1 query paginada no Supabase +
// re-embed APENAS do delta. Run semanal via GitHub Actions.

import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { verifyWebhookHmac, deriveEventKey, resolveWebhookOwnerId } from "@/lib/webhooks/hmac"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { embedText } from "@/lib/ollama"
import { ensureCollection } from "@/lib/qdrant"
import { contentHash, embeddableText } from "@/lib/content-hash"
import { logger } from "@/lib/logger"

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333"
const QDRANT_COLLECTION = process.env.QDRANT_COLLECTION || "ops_hub_notes"
const QDRANT_TIMEOUT_MS = Number(process.env.QDRANT_TIMEOUT_MS) || 10_000
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || ""
const RECONCILE_AUTH_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  ...(QDRANT_API_KEY ? { "api-key": QDRANT_API_KEY } : {}),
}
const SCROLL_LIMIT = 256
const NOTE_PAGE_SIZE = 500
const RE_EMBED_DELAY_MS = Number(process.env.RECONCILE_EMBED_DELAY_MS) || 250
const MAX_RE_EMBEDS = Number(process.env.RECONCILE_MAX_RE_EMBEDS) || 50

interface QdrantPayload {
  content_hash?: string
  model?: string
}

interface QdrantPoint {
  id: string
  payload?: QdrantPayload
}

async function qdrantScrollForHashes(ownerId: string): Promise<Map<string, string>> {
  const hashes = new Map<string, string>()
  let offset: string | null = null

  for (;;) {
    const res = await fetchWithTimeout(
      `${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points/scroll`,
      {
        method: "POST",
        headers: RECONCILE_AUTH_HEADERS,
        body: JSON.stringify({
          limit: SCROLL_LIMIT,
          with_payload: true,
          filter: {
            must: [{ key: "owner_id", match: { value: ownerId } }],
          },
          ...(offset ? { offset } : {}),
        }),
      },
      QDRANT_TIMEOUT_MS,
    )
    if (res.status === 404) {
      // Coleção ainda não existe (primeira run, sync nunca rodou) — tratamos
      // como "vetorial vazio": TODAS as notes serão consideradas missing.
      return hashes
    }
    if (!res.ok) throw new Error(`qdrant scroll failed: ${res.status}`)
    const data = (await res.json()) as {
      result?: { points: QdrantPoint[] }
      next_page_offset?: string | null
    }
    for (const p of data.result?.points ?? []) {
      if (p.payload?.content_hash) hashes.set(p.id, p.payload.content_hash)
    }
    offset = data.next_page_offset ?? null
    if (!offset) break
  }
  return hashes
}

/** Hash determinista do texto embedado — definido em src/lib/content-hash.ts. */

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  if (!(await verifyWebhookHmac(req, rawBody, process.env.EMBEDDINGS_RECONCILE_SECRET))) {
    return NextResponse.json({ error: "Assinatura inválida" }, { status: 401 })
  }

  const body = rawBody ? (JSON.parse(rawBody) as { owner_id?: string }) : {}
  const triggerId = (await deriveEventKey(rawBody)).slice(0, 8)

  // owner_id: do payload (validado UUID) ou fallback para WEBHOOK_OWNER_ID
  const ownerId: string | null = body.owner_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.owner_id)
    ? body.owner_id
    : resolveWebhookOwnerId()
  if (!ownerId) {
    logger.error("reconcile", "owner_id/WEBHOOK_OWNER_ID não configurado", {})
    return NextResponse.json({ error: "Servidor não configurado" }, { status: 500 })
  }

  const embedModel = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text"
  const start = Date.now()

  // 1. Mapa noteId → content_hash do vetorial (Qdrant, scroll paginado)
  let qdrantHashes: Map<string, string>
  try {
    qdrantHashes = await qdrantScrollForHashes(ownerId)
  } catch (err) {
    logger.error("reconcile", "Qdrant scroll falhou", { error: (err as Error).message })
    return NextResponse.json({ error: "Qdrant indisponível" }, { status: 502 })
  }

  // 2. Varre notes do owner (paginado), compara hash, re-sync divergentes
  const supabase = createServiceClient()
  let scanned = 0
  let missing = 0
  let stale = 0
  let current = 0
  let reEmbedded = 0
  const errors: string[] = []

  for (let from = 0; ; from += NOTE_PAGE_SIZE) {
    const { data: notes, error } = await supabase
      .from("note")
      .select("id, title, content, owner_id, updated_at")
      .eq("owner_id", ownerId)
      .range(from, from + NOTE_PAGE_SIZE - 1)
    if (error) {
      logger.error("reconcile", "Falha ao ler notes", { error: error.message })
      return NextResponse.json({ error: "Falha ao ler notas" }, { status: 500 })
    }
    if (!notes || notes.length === 0) break

    for (const note of notes) {
      scanned++
      const text = embeddableText(note)
      if (!text) continue
      const expected = await contentHash(text)
      const stored = qdrantHashes.get(note.id)
      if (!stored) missing++
      else if (stored === expected) current++
      else stale++

      if (!stored || stored !== expected) {
        if (reEmbedded >= MAX_RE_EMBEDS) continue
        try {
          // Mesma lógica do syncNoteEmbeddingCore (reimplementada localmente
          // p/ incluir content_hash no payload — o core não grava hash)
          const embedding = await embedText(text)
          await ensureCollection()
          const res = await fetchWithTimeout(
            `${QDRANT_URL}/collections/${QDRANT_COLLECTION}/points`,
            {
              method: "PUT",
              headers: RECONCILE_AUTH_HEADERS,
              body: JSON.stringify({
                points: [
                  {
                    id: note.id,
                    vector: embedding,
                    payload: {
                      owner_id: ownerId,
                      note_id: note.id,
                      title: note.title,
                      content_preview: (note.content || "").slice(0, 200),
                      content_hash: expected,
                      model: embedModel,
                    },
                  },
                ],
              }),
            },
            QDRANT_TIMEOUT_MS,
          )
          if (!res.ok) throw new Error(`upsert ${res.status}`)
          reEmbedded++
        } catch (err) {
          errors.push(`${note.id.slice(0, 8)}: ${(err as Error).message}`)
        }
        // Ritmo p/ não saturar o Ollama local num sweep grande
        await new Promise((r) => setTimeout(r, RE_EMBED_DELAY_MS))
      }
    }
    if (notes.length < NOTE_PAGE_SIZE) break
  }

  // 3. Órfãos no Qdrant (nota deletada sem deleteNoteEmbedding) — não deleta,
  //    só reporta: deleção é risco baixo (payload filtrado por owner) mas
  //    ocupa espaço. Deleção ativa fica para iteração futura se necessário.
  let orphanCount = 0
  const noteIdsThisRun = new Set<string>()
  for (let from = 0; ; from += NOTE_PAGE_SIZE) {
    const { data: notes } = await supabase
      .from("note")
      .select("id")
      .eq("owner_id", ownerId)
      .range(from, from + NOTE_PAGE_SIZE - 1)
    if (!notes || notes.length === 0) break
    for (const n of notes) noteIdsThisRun.add(n.id)
    if (notes.length < NOTE_PAGE_SIZE) break
  }
  for (const pointId of qdrantHashes.keys()) {
    if (!noteIdsThisRun.has(pointId)) orphanCount++
  }

  logger.info("reconcile", "Reconciliação concluída", {
    ownerId,
    embedModel,
    trigger: triggerId,
    scanned,
    missing,
    stale,
    current,
    reEmbedded,
    orphanCount,
    errors: errors.slice(0, 5),
    durationMs: Date.now() - start,
  })

  return NextResponse.json({
    ok: true,
    scanned,
    missing,
    stale,
    current,
    reEmbedded,
    orphanCount,
    capped: reEmbedded >= MAX_RE_EMBEDS,
    errors: errors.slice(0, 5),
    durationMs: Date.now() - start,
  })
}