// Hash de conteúdo para reconciliação de embeddings — a regra crítica é ser
// determinístico e divergir quando o conteúdo muda; senão o reconciler não
// detecta drift entre DB e Qdrant.
import { describe, it, expect } from "vitest"
import { contentHash, embeddableText } from "@/lib/content-hash"

describe("embeddableText", () => {
  it("concatena title + duas quebras + content", () => {
    expect(embeddableText({ title: "T", content: "C" })).toBe("T\n\nC")
  })

  it("content null vira vazio e trim limpa as pontas (title-only estável)", () => {
    expect(embeddableText({ title: "T", content: null })).toBe("T")
  })

  it("trim age nas pontas da string inteira (whitespace interno preservado)", () => {
    expect(embeddableText({ title: " T ", content: "  C  " })).toBe("T \n\n  C")
  })
})

describe("contentHash", () => {
  it("é determinístico", async () => {
    const a = await contentHash("texto")
    const b = await contentHash("texto")
    expect(a).toBe(b)
  })

  it("difere quando o conteúdo muda (drift detection)", async () => {
    const a = await contentHash("T\n\nversão 1")
    const b = await contentHash("T\n\nversão 2")
    expect(a).not.toBe(b)
  })

  it("difere quando só mudança de whitespace interno relevante", async () => {
    const a = await contentHash("T\n\nlinha um\nlinha dois")
    const b = await contentHash("T\n\nlinha um linha dois")
    expect(a).not.toBe(b)
  })

  it("retorna 32 hex chars (128 bits)", async () => {
    expect(await contentHash("x")).toMatch(/^[0-9a-f]{32}$/)
  })

  it("hash vazio é estável (nota vazia nunca diverge por acidente)", async () => {
    const a = await contentHash("")
    const b = await contentHash("")
    expect(a).toBe(b)
  })
})