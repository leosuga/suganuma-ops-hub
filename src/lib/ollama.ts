// Ollama embedding + chat client — local inference via Docker container
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text"
const CHAT_MODEL = process.env.OLLAMA_CHAT_MODEL || "llama3.2"

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
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      stream: false,
      temperature: options?.temperature ?? 0.3,
      ...(options?.format === "json" ? { format: "json" } : {}),
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`Ollama chat failed: ${res.status} ${text}`)
  }

  const data = (await res.json()) as { message: { content: string } }
  return data.message.content
}
