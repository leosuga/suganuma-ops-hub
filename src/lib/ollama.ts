// Ollama client — embeddings local (VPS) + chat cloud (ollama.com)
//
// Embeddings: local Ollama container on VPS (nomic-embed-text, 768-dim).
//   Used by Qdrant sync, semantic search, and duplicate detection.
//   Low latency, private, zero cost — stays local.
//
// Chat: Ollama Cloud (https://ollama.com) with Bearer API key.
//   Used by inbox auto-triage. Better models, no VPS GPU needed.
//   Falls back to local Ollama if OLLAMA_API_KEY is not set.

import { logger } from "@/lib/logger"
import { fetchWithTimeout } from "@/lib/fetch-with-timeout"

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text"

const OLLAMA_CLOUD_URL = process.env.OLLAMA_CLOUD_URL || "https://ollama.com"
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY || ""
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "gpt-oss:20b"

// LLM calls can legitimately take a while (cloud chat, batch embeds) but must
// never hang forever — a stuck request blocks the whole raindrop-sync run.
const OLLAMA_TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS) || 120_000

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (!inputs.length) return []

  const res = await fetchWithTimeout(
    `${OLLAMA_URL}/api/embed`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: EMBED_MODEL,
        input: inputs,
      }),
    },
    OLLAMA_TIMEOUT_MS,
  )

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
    const res = await fetchWithTimeout(`${OLLAMA_URL}/api/tags`, { method: "GET" }, 5_000)
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
      const res = await fetchWithTimeout(
        `${OLLAMA_CLOUD_URL}/api/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OLLAMA_API_KEY}`,
          },
          body,
        },
        OLLAMA_TIMEOUT_MS,
      )

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        throw new Error(`Ollama Cloud chat failed: ${res.status} ${text}`)
      }

      const data = (await res.json()) as { message: { content: string } }
      return data.message.content
    } catch (err) {
      // Fall through to local Ollama on any cloud failure
      logger.warn("ollama", `cloud chat failed, falling back to local`, { error: (err as Error).message })
    }
  }

  // Fallback: local Ollama (llama3.2 or OLLAMA_CHAT_MODEL)
  const res = await fetchWithTimeout(
    `${OLLAMA_URL}/api/chat`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    },
    OLLAMA_TIMEOUT_MS,
  )

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Ollama chat failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as { message: { content: string } }
  return data.message.content
}