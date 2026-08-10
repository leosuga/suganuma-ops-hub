// Ollama client — embeddings local (VPS) + chat cloud (ollama.com)
//
// Embeddings: local Ollama container on VPS (nomic-embed-text, 768-dim).
//   Used by Qdrant sync, semantic search, and duplicate detection.
//   Low latency, private, zero cost — stays local.
//
// Chat: Ollama Cloud (https://ollama.com) with Bearer API key.
//   Used by inbox auto-triage. Better models, no VPS GPU needed.
//   Falls back to local Ollama if OLLAMA_API_KEY is not set.

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text"

const OLLAMA_CLOUD_URL = process.env.OLLAMA_CLOUD_URL || "https://ollama.com"
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || ""
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "gpt-oss:20b"

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (!inputs.length) return []

  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: EMBED_MODEL,
      input: inputs,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Ollama embed failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as { embeddings: number[][] }
  return data.embeddings
}

export async function embedText(input: string): Promise<number[]> {
  const [embedding] = await embedTexts([input])
  return embedding
}

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { method: "GET" })
    return res.ok
  } catch {
    return false
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export async function chatCompletion(
  messages: ChatMessage[],
  options?: { temperature?: number; format?: "json" }
): Promise<string> {
  const body = JSON.stringify({
    model: CHAT_MODEL,
    messages,
    stream: false,
    temperature: options?.temperature ?? 0.3,
    ...(options?.format === "json" ? { format: "json" } : {}),
  })

  // Primary: Ollama Cloud with API key
  if (OLLAMA_API_KEY) {
    try {
      const res = await fetch(`${OLLAMA_CLOUD_URL}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OLLAMA_API_KEY}`,
        },
        body,
      })

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`Ollama Cloud chat failed: ${res.status} ${text}`)
      }

      const data = (await res.json()) as { message: { content: string } }
      return data.message.content
    } catch (err) {
      // Fall through to local Ollama on any cloud failure
      console.warn(`[ollama] Cloud chat failed, falling back to local: ${(err as Error).message}`)
    }
  }

  // Fallback: local Ollama (llama3.2 or OLLAMA_CHAT_MODEL)
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Ollama chat failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as { message: { content: string } }
  return data.message.content
}