// Qdrant vector search client — self-hosted on same VPS network
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333"
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || "ops_hub_notes"
const VECTOR_DIM = 768 // nomic-embed-text output dimension

const QDRANT_TIMEOUT_MS = Number(process.env.QDRANT_TIMEOUT_MS) || 10_000
// API key opcional do servidor Qdrant (QDRANT__SERVICE__API_KEY lá). Se setada,
// vai no header `api-key` de TODAS as chamadas — sem ela o Qdrant responde 401.
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || ""

function qdrantHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(QDRANT_API_KEY ? { "api-key": QDRANT_API_KEY } : {}),
    ...extra,
  }
}

// Cache em variável de módulo: a collection não some sozinha em runtime, então
// checar/criar a cada busca era um round-trip HTTP a mais por request. O cache
// também deduplica chamadas concorrentes (todas aguardam a mesma promise).
let collectionEnsured: Promise<void> | null = null

// Qdrant collection setup (idempotent)
export function ensureCollection(): Promise<void> {
  if (!collectionEnsured) {
    collectionEnsured = ensureCollectionUncached().catch((err) => {
      collectionEnsured = null // permite retry na próxima chamada
      throw err
    })
  }
  return collectionEnsured
}

async function ensureCollectionUncached(): Promise<void> {
  const exists = await collectionExists()
  if (exists) return

  const res = await fetchWithTimeout(
    `${QDRANT_URL}/collections/${COLLECTION_NAME}`,
    {
      method: "PUT",
      headers: qdrantHeaders(),
      body: JSON.stringify({
        vectors: {
          size: VECTOR_DIM,
          distance: "Cosine",
        },
      }),
    },
    QDRANT_TIMEOUT_MS,
  )

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    // 409 = já existe (corrida entre chamadas concorrentes) — estado final é o
    // desejado, tratar como sucesso. Visto no bulk reconcile: 50 embeds mortos
    // por 409 na run seguinte.
    if (res.status !== 409) {
      throw new Error(`Qdrant create collection failed: ${res.status} ${text}`)
    }
  }
}

export async function collectionExists(): Promise<boolean> {
  const res = await fetchWithTimeout(
    `${QDRANT_URL}/collections/${COLLECTION_NAME}/exists`,
    { method: "GET", headers: qdrantHeaders() },
    QDRANT_TIMEOUT_MS,
  )
  // 404 = coleção não existe. QUALQUER outro erro (401 auth, 5xx) deve
  // PROPAGAR — tratar como "não existe" fazia a create correr e o upsert
  // falhar em cascata com 409.
  if (res.status === 404) return false
  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Qdrant exists check failed: ${res.status} ${text}`)
  }
  const data = (await res.json()) as { result: { exists: boolean } }
  return data.result.exists
}

// Upsert a note vector with owner_id in payload for filtering
export async function upsertNoteVector(
  noteId: string,
  ownerId: string,
  embedding: number[],
  payload?: Record<string, unknown>
): Promise<void> {
  const res = await fetchWithTimeout(
    `${QDRANT_URL}/collections/${COLLECTION_NAME}/points`,
    {
      method: "PUT",
      headers: qdrantHeaders(),
      body: JSON.stringify({
        points: [
          {
            id: noteId,
            vector: embedding,
            payload: {
              owner_id: ownerId,
              note_id: noteId,
              ...(payload || {}),
            },
          },
        ],
      }),
    },
    QDRANT_TIMEOUT_MS,
  )

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Qdrant upsert failed: ${res.status} ${text}`)
  }
}

// Delete a note vector
export async function deleteNoteVector(noteId: string): Promise<void> {
  const res = await fetchWithTimeout(
    `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/delete`,
    {
      method: "POST",
      headers: qdrantHeaders(),
      body: JSON.stringify({
        points: [noteId],
      }),
    },
    QDRANT_TIMEOUT_MS,
  )

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Qdrant delete failed: ${res.status} ${text}`)
  }
}

// Semantic search filtered by owner_id
export async function searchNotes(
  ownerId: string,
  embedding: number[],
  limit: number = 10,
  scoreThreshold: number = 0.7
): Promise<Array<{ id: string; score: number; payload?: Record<string, unknown> }>> {
  const res = await fetchWithTimeout(
    `${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`,
    {
      method: "POST",
      headers: qdrantHeaders(),
      body: JSON.stringify({
        vector: embedding,
        limit,
        score_threshold: scoreThreshold,
        with_payload: true,
        filter: {
          must: [
            {
              key: "owner_id",
              match: { value: ownerId },
            },
          ],
        },
      }),
    },
    QDRANT_TIMEOUT_MS,
  )

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Qdrant search failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as {
    result: Array<{ id: string; score: number; payload?: Record<string, unknown> }>
  }
  return data.result
}

// Check Qdrant health
export async function checkQdrantHealth(): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(`${QDRANT_URL}/healthz`, { method: "GET", headers: qdrantHeaders() }, 5_000)
    return res.ok
  } catch {
    return false
  }
}
