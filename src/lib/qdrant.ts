// Qdrant vector search client — self-hosted on same VPS network
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333"
const COLLECTION_NAME = process.env.QDRANT_COLLECTION || "ops_hub_notes"
const VECTOR_DIM = 768 // nomic-embed-text output dimension

// Qdrant collection setup (idempotent)
export async function ensureCollection(): Promise<void> {
  const exists = await collectionExists()
  if (exists) return

  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vectors: {
        size: VECTOR_DIM,
        distance: "Cosine",
      },
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Qdrant create collection failed: ${res.status} ${text}`)
  }
}

export async function collectionExists(): Promise<boolean> {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/exists`, {
    method: "GET",
  })
  if (!res.ok) return false
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
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
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
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Qdrant upsert failed: ${res.status} ${text}`)
  }
}

// Delete a note vector
export async function deleteNoteVector(noteId: string): Promise<void> {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      points: [noteId],
    }),
  })

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
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
  })

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
    const res = await fetch(`${QDRANT_URL}/healthz`, { method: "GET" })
    return res.ok
  } catch {
    return false
  }
}
