// Ollama embed: keep_alive + teto de tempo por chamada.
//
// O cold start do nomic-embed-text (modelo descarregado por ociosidade) era a
// causa real do -32001 na busca pelo MCP — não o tamanho da query. keep_alive
// no corpo do POST /api/embed é o fix; o timeout por chamada permite que a
// busca interativa use um teto curto sem mexer no default de 120 s do lote
// do raindrop-sync.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/fetch-with-timeout", () => ({ fetchWithTimeout: vi.fn() }))

import { fetchWithTimeout } from "@/lib/fetch-with-timeout"
import { embedText, embedTexts } from "@/lib/ollama"

const mockFetchWithTimeout = fetchWithTimeout as unknown as ReturnType<typeof vi.fn>

function embedResponse(vectors: number[][]) {
  return { ok: true, json: async () => ({ embeddings: vectors }) } as unknown as Response
}

function lastCall() {
  const [url, init, timeoutMs] = mockFetchWithTimeout.mock.calls.at(-1)!
  return {
    url: url as string,
    body: JSON.parse((init as RequestInit).body as string) as Record<string, unknown>,
    timeoutMs: timeoutMs as number,
  }
}

describe("embedTexts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mockFetchWithTimeout.mockResolvedValue(embedResponse([[0.1, 0.2]]))
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("manda keep_alive no corpo do POST /api/embed", async () => {
    await embedTexts(["data drift"])

    const { url, body } = lastCall()
    expect(url).toContain("/api/embed")
    expect(body.input).toEqual(["data drift"])
    expect(body.keep_alive).toBe("30m")
  })

  it("respeita OLLAMA_EMBED_KEEP_ALIVE quando definido", async () => {
    vi.stubEnv("OLLAMA_EMBED_KEEP_ALIVE", "-1")
    await embedTexts(["drift"])

    expect(lastCall().body.keep_alive).toBe("-1")
  })

  it("sem timeout explícito, mantém o default de 120 s", async () => {
    await embedTexts(["drift"])

    expect(lastCall().timeoutMs).toBe(120_000)
  })

  it("aceita teto próprio por chamada (busca interativa)", async () => {
    await embedText("drift", 8_000)

    expect(lastCall().timeoutMs).toBe(8_000)
  })

  it("lista vazia não faz request", async () => {
    const res = await embedTexts([])

    expect(res).toEqual([])
    expect(mockFetchWithTimeout).not.toHaveBeenCalled()
  })
})
