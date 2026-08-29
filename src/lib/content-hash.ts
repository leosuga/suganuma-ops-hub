// Hash de conteúdo para reconciliação de embeddings.
// Deve refletir EXATAMENTE o texto que o sync core embarca:
//   `${note.title}\n\n${note.content || ""}`.trim()   (semantic-search.ts)
// Truncado a 32 hex chars (128 bits) — colisão irrelevante para
// reconciliação e mantém o payload do Qdrant compacto.

export async function contentHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  const hex = Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return hex.slice(0, 32)
}

/** Texto canônico que é embedado — único lugar que define a concatenação. */
export function embeddableText(note: { title: string; content: string | null }): string {
  return `${note.title}\n\n${note.content || ""}`.trim()
}