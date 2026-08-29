// Qdrant client HTTP — node:http nativo em vez de global fetch.
//
// Motivo (2026-08-29): o fetch do Next.js runtime é "patched" e apresentou
// comportamento de cache/dedup em Route Handlers que quebrou o reconcile
// (POST de scroll retornava resultado stale e PUTs não persistiam —
// observável: count do Qdrant fixo em 309 enquanto a route reportava
// reEmbedded:50, e node standalone via o estado correto).
// node:http não passa pelo patch e é imune ao cache do Next.

import http from "node:http"
import { logger } from "@/lib/logger"

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

interface HttpResponse {
  status: number
  body: string
}

/** node:http request com promise, timeout e parse JSON. */
export function qdrantRequest<T = unknown>(
  method: "GET" | "PUT" | "POST" | "DELETE",
  path: string,
  body?: unknown,
): Promise<{ status: number; json: T }> {
  return new Promise((resolve, reject) => {
    const url = new URL(`${QDRANT_URL}${path}`)
    const payload = body === undefined ? null : JSON.stringify(body)
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers: qdrantHeaders(payload ? { "Content-Length": String(Buffer.byteLength(payload)) } : {}),
        timeout: QDRANT_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => {
          const status = res.statusCode ?? 0
          const text = Buffer.concat(chunks).toString("utf8")
          let json: unknown = null
          try {
            json = JSON.parse(text)
          } catch {
            json = null
          }
          resolve({ status, json: json as T })
        })
      },
    )
    req.on("timeout", () => {
      req.destroy(new Error(`qdrant timeout após ${QDRANT_TIMEOUT_MS}ms`))
    })
    req.on("error", reject)
    if (payload) req.write(payload)
    req.end()
  })
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

  const { status } = await qdrantRequest("PUT", `/collections/${COLLECTION_NAME}`, {
    vectors: {
      size: VECTOR_DIM,
      distance: "Cosine",
    },
  })

  // 409 = já existe (corrida entre chamadas concorrentes) — estado final é o
  // desejado, tratar como sucesso.
  if (status !== 200 && status !== 409) {
    throw new Error(`Qdrant create collection failed: ${status}`)
  }
}

export async function collectionExists(): Promise<boolean> {
  // 404 = coleção não existe. QUALQUER outro erro (401 auth, 5xx) deve
  // PROPAGAR — tratar como "não existe" fazia a create correr e o upsert
  // falhar em cascata com 409.
  const { status, json } = await qdrantRequest<{ result?: { exists: boolean } }>(
    "GET",
    `/collections/${COLLECTION_NAME}/exists`,
  )
  if (status === 404) return false
  if (status !== 200) {
    throw new Error(`Qdrant exists check failed: ${status} (body: ${JSON.stringify(json).slice(0, 120)})`)
  }
  return Boolean((json as { result?: { exists?: boolean } })?.result?.exists)
}

// Upsert a note vector with owner_id in payload for filtering
export async function upsertNoteVector(
  noteId: string,
  ownerId: string,
  embedding: number[],
  payload?: Record<string, unknown>
): Promise<void> {
  const { status } = await qdrantRequest("PUT", `/collections/${COLLECTION_NAME}/points`, {
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
  })

  if (status !== 200) {
    throw new Error(`Qdrant upsert failed: ${status}`)
  }
}

// Delete a note vector
export async function deleteNoteVector(noteId: string): Promise<void> {
  const { status } = await qdrantRequest("POST", `/collections/${COLLECTION_NAME}/points/delete`, {
    points: [noteId],
  })

  if (status !== 200) {
    throw new Error(`Qdrant delete failed: ${status}`)
  }
}

// Semantic search filtered by owner_id
export async function searchNotes(
  ownerId: string,
  embedding: number[],
  limit: number = 10,
  scoreThreshold: number = 0.7
): Promise<Array<{ id: string; score: number; payload?: Record<string, unknown> }>> {
  const { status, json } = await qdrantRequest(
    "POST",
    `/collections/${COLLECTION_NAME}/points/search`,
    {
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
    },
  )

  if (status !== 200) {
    throw new Error(`Qdrant search failed: ${status}`)
  }

  const data = json as { result: Array<{ id: string; score: number; payload?: Record<string, unknown> }> }
  return data.result
}

// Check Qdrant health (healthz não precisa de auth, mas envia por consistência)
export async function checkQdrantHealth(): Promise<boolean> {
  try {
    const { status } = await qdrantRequest("GET", "/healthz")
    return status === 200
  } catch {
    return false
  }
}