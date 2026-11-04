// Testes do núcleo da busca híbrida (Qdrant + Postgres FTS + RRF).
//
// O bug que originou este arquivo: `.textSearch(...)` sem `type` manda o
// PostgREST para `to_tsquery`, que ERRA com espaço nu — toda query de 2+
// palavras perdia a perna FTS em silêncio e a busca virava só vetorial.
// `type: "websearch"` (websearch_to_tsquery) aceita espaço, aspas e `-`.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/ollama", () => ({ embedText: vi.fn() }))
vi.mock("@/lib/qdrant", () => ({
  ensureCollection: vi.fn(),
  searchNotes: vi.fn(),
}))
vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { embedText } from "@/lib/ollama"
import { ensureCollection, searchNotes } from "@/lib/qdrant"
import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logger"
import { hybridSearchCore } from "@/lib/hybrid-search-core"

const mockEmbedText = embedText as unknown as ReturnType<typeof vi.fn>
const mockEnsureCollection = ensureCollection as unknown as ReturnType<typeof vi.fn>
const mockSearchNotes = searchNotes as unknown as ReturnType<typeof vi.fn>
const mockCreateServiceClient = createServiceClient as unknown as ReturnType<typeof vi.fn>
const mockWarn = logger.warn as unknown as ReturnType<typeof vi.fn>

type Row = Record<string, unknown>

interface TextSearchCall {
  column: string
  query: string
  options: Record<string, unknown>
}

function noteRow(id: string): Row {
  return {
    id,
    title: `nota ${id}`,
    content: `conteúdo ${id}`,
    tags: ["drift"],
    para: "resources",
    is_moc: false,
    project_id: null,
    pinned: false,
    updated_at: "2026-11-04T00:00:00.000Z",
  }
}

/**
 * Cliente Supabase falso. O primeiro `from("note")` é a perna FTS (termina em
 * `.limit().then()`); os seguintes são a busca dos ids que só vieram do vetor
 * (termina em `.in().eq()`, resolvida por `await` no thenable da cadeia).
 */
function mockClient(cfg: {
  fts?: { data?: Row[]; error?: { message: string } | null }
  byId?: { data?: Row[]; error?: { message: string } | null }
}) {
  const textSearchCalls: TextSearchCall[] = []
  let fromCalls = 0

  const resultFor = (mode: "fts" | "byId") => {
    const branch = mode === "fts" ? cfg.fts : cfg.byId
    return { data: branch?.data ?? [], error: branch?.error ?? null }
  }

  const client = {
    from: () => {
      const mode: "fts" | "byId" = fromCalls++ === 0 ? "fts" : "byId"
      const result = resultFor(mode)
      const chain: Record<string, unknown> = {
        select: () => chain,
        eq: () => chain,
        in: () => chain,
        limit: () => chain,
        textSearch: (column: string, query: string, options: Record<string, unknown>) => {
          textSearchCalls.push({ column, query, options })
          return chain
        },
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      }
      return chain
    },
  }

  return { client, textSearchCalls }
}

describe("hybridSearchCore", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3])
    mockEnsureCollection.mockResolvedValue(undefined)
    mockSearchNotes.mockResolvedValue([])
  })

  it("query multi-palavra busca no FTS com websearch_to_tsquery", async () => {
    const { client, textSearchCalls } = mockClient({})
    mockCreateServiceClient.mockReturnValue(client as never)

    const res = await hybridSearchCore("owner-1", "data drift", 10)

    expect(res.ok).toBe(true)
    expect(textSearchCalls).toHaveLength(1)
    expect(textSearchCalls[0].column).toBe("search_vector")
    expect(textSearchCalls[0].query).toBe("data drift")
    expect(textSearchCalls[0].options).toMatchObject({ config: "portuguese", type: "websearch" })
  })

  it("id presente nas duas pernas vira source hybrid", async () => {
    const { client } = mockClient({ fts: { data: [noteRow("n1")] } })
    mockCreateServiceClient.mockReturnValue(client as never)
    mockSearchNotes.mockResolvedValue([{ id: "n1", score: 0.91 }])

    const res = await hybridSearchCore("owner-1", "data drift", 10)

    expect(res.ok).toBe(true)
    expect(res.results).toHaveLength(1)
    expect(res.results[0].id).toBe("n1")
    expect(res.results[0].source).toBe("hybrid")
    expect(res.debug).toEqual({ fts_ok: true, vector_ok: true })
  })

  it("falha do FTS não derruba a busca e marca fts_ok=false", async () => {
    const { client } = mockClient({
      fts: { error: { message: "syntax error in tsquery" } },
      byId: { data: [noteRow("n1")] },
    })
    mockCreateServiceClient.mockReturnValue(client as never)
    mockSearchNotes.mockResolvedValue([{ id: "n1", score: 0.88 }])

    const res = await hybridSearchCore("owner-1", "data drift", 10)

    expect(res.ok).toBe(true)
    expect(res.debug).toEqual({ fts_ok: false, vector_ok: true })
    expect(res.results).toHaveLength(1)
    expect(res.results[0].source).toBe("vector")

    // O log precisa dizer QUAL query falhou — sem isso, falha de sintaxe do
    // tsquery fica indistinguível de "não achou nada".
    expect(mockWarn).toHaveBeenCalledWith(
      "hybridSearchCore",
      "FTS search failed (non-blocking)",
      expect.objectContaining({ query: "data drift", error: "syntax error in tsquery" }),
    )
  })

  it("falha do vetor não derruba a busca e marca vector_ok=false", async () => {
    const { client } = mockClient({ fts: { data: [noteRow("n2")] } })
    mockCreateServiceClient.mockReturnValue(client as never)
    mockSearchNotes.mockRejectedValue(new Error("qdrant fora do ar"))

    const res = await hybridSearchCore("owner-1", "drift", 10)

    expect(res.ok).toBe(true)
    expect(res.debug).toEqual({ fts_ok: true, vector_ok: false })
    expect(res.results.map((r) => r.id)).toEqual(["n2"])
    expect(res.results[0].source).toBe("fts")
  })

  it("query vazia não toca em nenhuma perna", async () => {
    const { client, textSearchCalls } = mockClient({})
    mockCreateServiceClient.mockReturnValue(client as never)

    const res = await hybridSearchCore("owner-1", "   ", 10)

    expect(res.ok).toBe(true)
    expect(res.results).toEqual([])
    expect(textSearchCalls).toHaveLength(0)
    expect(mockEmbedText).not.toHaveBeenCalled()
  })
})

// O teto da perna vetorial: a busca nunca pode ficar esperando o Ollama frio.
// Com o modelo quente (keep_alive, ver tests/ollama-embed.test.ts) esse caminho
// quase nunca dispara; quando dispara, é melhor um resultado só de FTS do que
// estourar o timeout do cliente MCP (-32001).
describe("hybridSearchCore — teto da perna vetorial", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
    mockEnsureCollection.mockResolvedValue(undefined)
    mockSearchNotes.mockResolvedValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllEnvs()
  })

  it("embedding acima de SEARCH_EMBED_TIMEOUT_MS: responde só com FTS, no teto", async () => {
    vi.useFakeTimers()
    const { client } = mockClient({ fts: { data: [noteRow("n2")] } })
    mockCreateServiceClient.mockReturnValue(client as never)
    // Ollama pendurado: a promessa nunca resolve.
    mockEmbedText.mockReturnValue(new Promise<number[]>(() => {}))

    const pending = hybridSearchCore("owner-1", "data drift", 10)
    let settled = false
    void pending.then(() => { settled = true })

    // Um milissegundo antes do teto, nada aconteceu ainda.
    await vi.advanceTimersByTimeAsync(7_999)
    expect(settled).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    const res = await pending

    expect(res.ok).toBe(true)
    expect(res.debug).toEqual({ fts_ok: true, vector_ok: false })
    expect(res.results.map((r) => r.id)).toEqual(["n2"])
    expect(res.results[0].source).toBe("fts")
    expect(mockSearchNotes).not.toHaveBeenCalled()
    expect(mockWarn).toHaveBeenCalledWith(
      "hybridSearchCore",
      "Vector search failed (non-blocking)",
      expect.objectContaining({ query: "data drift", cap_ms: 8_000 }),
    )
  })

  it("respeita SEARCH_EMBED_TIMEOUT_MS customizado", async () => {
    vi.useFakeTimers()
    vi.stubEnv("SEARCH_EMBED_TIMEOUT_MS", "500")
    const { client } = mockClient({ fts: { data: [noteRow("n2")] } })
    mockCreateServiceClient.mockReturnValue(client as never)
    mockEmbedText.mockReturnValue(new Promise<number[]>(() => {}))

    const pending = hybridSearchCore("owner-1", "data drift", 10)
    await vi.advanceTimersByTimeAsync(500)
    const res = await pending

    expect(res.debug).toEqual({ fts_ok: true, vector_ok: false })
    expect(res.results.map((r) => r.id)).toEqual(["n2"])
  })

  it("modelo quente: nenhum teto é pago e a duração de cada perna vai para o log", async () => {
    const { client } = mockClient({ fts: { data: [noteRow("n1")] } })
    mockCreateServiceClient.mockReturnValue(client as never)
    mockEmbedText.mockResolvedValue([0.1, 0.2, 0.3])
    mockSearchNotes.mockResolvedValue([{ id: "n1", score: 0.9 }])

    const res = await hybridSearchCore("owner-1", "data drift", 10)

    expect(res.debug).toEqual({ fts_ok: true, vector_ok: true })
    expect(mockEmbedText).toHaveBeenCalledWith("data drift", 8_000)
    const infoCall = (logger.info as unknown as ReturnType<typeof vi.fn>).mock.calls.find(
      ([, msg]) => msg === "search done",
    )
    expect(infoCall?.[2]).toEqual(
      expect.objectContaining({ vector_ms: expect.any(Number), fts_ms: expect.any(Number) }),
    )
  })
})
