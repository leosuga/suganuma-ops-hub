// Ollama embedding client — local inference via Docker container
const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text"

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
