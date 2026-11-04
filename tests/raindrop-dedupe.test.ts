// Dedupe por URL da ponte Raindrop (segunda camada de idempotência).
//
// A primeira camada (`raindrop_id` em webhook_event) só pega replay do MESMO
// bookmark. As duplicatas reais do Inbox vêm de a mesma URL ter sido salva duas
// vezes no Raindrop ou capturada por outro caminho (Share Target). Aqui a URL é
// normalizada e comparada com o que o dono já tem em `note` e `inbox_item`.
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logger"
import {
  normalizeUrl,
  urlSearchKey,
  extractUrls,
  textHasUrl,
  findExistingByUrl,
} from "@/lib/raindrop-dedupe"

const mockCreateServiceClient = createServiceClient as unknown as ReturnType<typeof vi.fn>

type Row = { id: string; content: string | null }

/**
 * Cliente Supabase falso: devolve por tabela o resultado configurado, e
 * registra o padrão do `ilike` para conferir a chave de busca.
 */
function mockClient(cfg: { note?: Row[]; inbox?: Row[]; error?: { message: string } | null }) {
  const patterns: Array<{ table: string; pattern: string }> = []

  const client = {
    from: (table: string) => {
      const rows = table === "note" ? (cfg.note ?? []) : (cfg.inbox ?? [])
      const error = cfg.error ?? null
      const chain = {
        select: () => chain,
        eq: () => chain,
        ilike: (_column: string, pattern: string) => {
          patterns.push({ table, pattern })
          return chain
        },
        limit: () => Promise.resolve({ data: error ? null : rows, error }),
      }
      return chain
    },
  }

  return { client, patterns }
}

describe("normalizeUrl", () => {
  it("remove parâmetros de rastreio e mantém o resto ordenado", () => {
    expect(normalizeUrl("https://Example.com/post?utm_source=x&b=2&a=1&fbclid=abc")).toBe(
      "https://example.com/post?a=1&b=2",
    )
  })

  it("remove barra final e fragmento", () => {
    expect(normalizeUrl("https://example.com/artigo/#secao-2")).toBe("https://example.com/artigo")
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com")
  })

  it("preserva a caixa do path (alguns sites são case-sensitive)", () => {
    expect(normalizeUrl("https://example.com/Guia/Data-Drift")).toBe("https://example.com/Guia/Data-Drift")
  })

  it("idempotente", () => {
    const raw = "https://Example.com/a/?utm_medium=x&z=1#top"
    expect(normalizeUrl(normalizeUrl(raw))).toBe(normalizeUrl(raw))
  })

  it("URL inválida volta só com trim (dedupe falha, criação segue)", () => {
    expect(normalizeUrl("  não é uma url  ")).toBe("não é uma url")
  })
})

describe("urlSearchKey", () => {
  it("usa host + path, sem query nem barra final", () => {
    expect(urlSearchKey(normalizeUrl("https://example.com/artigo/?utm_source=x"))).toBe("example.com/artigo")
  })
})

describe("extractUrls / textHasUrl", () => {
  it("extrai URL da nota criada pelo sync (formato `Fonte: <url>`)", () => {
    const content = "Resumo do artigo.\n\nFonte: https://example.com/artigo?utm_source=raindrop"
    expect(extractUrls(content)).toEqual(["https://example.com/artigo?utm_source=raindrop"])
    expect(textHasUrl(content, normalizeUrl("https://example.com/artigo"))).toBe(true)
  })

  it("URL diferente (path distinto) não casa", () => {
    const content = "Fonte: https://example.com/outro-artigo"
    expect(textHasUrl(content, normalizeUrl("https://example.com/artigo"))).toBe(false)
  })

  it("query significativa distingue páginas (só o tracking é ignorado)", () => {
    const content = "[coleção]\nTítulo\nhttps://example.com/watch?id=1"
    expect(textHasUrl(content, normalizeUrl("https://example.com/watch?id=1&utm_source=x"))).toBe(true)
    expect(textHasUrl(content, normalizeUrl("https://example.com/watch?id=2"))).toBe(false)
  })
})

describe("findExistingByUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("mesma URL com utm diferente: encontra a nota e não cria de novo", async () => {
    const { client, patterns } = mockClient({
      note: [{ id: "n1", content: "resumo\n\nFonte: https://example.com/artigo?utm_source=raindrop" }],
    })
    mockCreateServiceClient.mockReturnValue(client as never)

    const found = await findExistingByUrl("owner-1", "https://example.com/artigo?utm_source=twitter&utm_campaign=x")

    expect(found).toBe("note")
    // A chave de busca é host+path: é o que existe como substring da URL crua
    // já gravada (as notas antigas têm tracking na URL).
    expect(patterns[0]).toEqual({ table: "note", pattern: "%example.com/artigo%" })
  })

  it("URL que só existe no Inbox conta como duplicata", async () => {
    const { client } = mockClient({
      note: [],
      inbox: [{ id: "i1", content: "[Trabalho]\nTítulo\nhttps://example.com/artigo" }],
    })
    mockCreateServiceClient.mockReturnValue(client as never)

    expect(await findExistingByUrl("owner-1", "https://example.com/artigo/")).toBe("inbox")
  })

  it("URL nova: null (pode criar)", async () => {
    const { client } = mockClient({ note: [], inbox: [] })
    mockCreateServiceClient.mockReturnValue(client as never)

    expect(await findExistingByUrl("owner-1", "https://example.com/novo")).toBeNull()
  })

  it("mesmo host/path mas query significativa diferente não é duplicata", async () => {
    const { client } = mockClient({
      note: [{ id: "n1", content: "Fonte: https://example.com/watch?id=1" }],
      inbox: [],
    })
    mockCreateServiceClient.mockReturnValue(client as never)

    expect(await findExistingByUrl("owner-1", "https://example.com/watch?id=2")).toBeNull()
  })

  it("checagem falhando não bloqueia a criação (melhor duplicar que perder)", async () => {
    const { client } = mockClient({ error: { message: "PostgREST fora do ar" } })
    mockCreateServiceClient.mockReturnValue(client as never)

    expect(await findExistingByUrl("owner-1", "https://example.com/artigo")).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith(
      "raindrop-sync",
      "Dedupe por URL falhou — seguindo com a criação",
      expect.objectContaining({ url: "https://example.com/artigo", error: "PostgREST fora do ar" }),
    )
  })
})
