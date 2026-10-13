import { describe, it, expect } from "vitest"
import {
  normalizeCategory,
  spendByCategory,
  categoryProgress,
  knownCategories,
} from "@/lib/finance/category"

const t = (kind: string, amount: number, category: string | null) => ({ kind, amount, category })

describe("normalizeCategory", () => {
  it("ignora caixa, acento e espaços extras", () => {
    expect(normalizeCategory("  Bebê ")).toBe("bebe")
    expect(normalizeCategory("BEBE")).toBe("bebe")
    expect(normalizeCategory("Saúde  e   Bem-estar")).toBe("saude e bem-estar")
  })
})

describe("spendByCategory", () => {
  it("soma despesas e impostos, como a barra global do orçamento", () => {
    const r = spendByCategory([t("expense", 100, "Bebê"), t("tax", 50, "bebe"), t("income", 999, "Bebê")])
    expect(r.get("bebe")?.total).toBe(150)
  })

  it("agrupa grafias diferentes e guarda o primeiro rótulo visto", () => {
    const r = spendByCategory([t("expense", 10, "Bebê"), t("expense", 5, "bebe ")])
    expect(r.size).toBe(1)
    expect(r.get("bebe")?.label).toBe("Bebê")
  })

  it("ignora transações sem categoria e converte amount numérico em string", () => {
    const r = spendByCategory([t("expense", 10, null), t("expense", 10, "  "), t("expense", Number("12.5"), "Farmácia")])
    expect(r.size).toBe(1)
    expect(r.get("farmacia")?.total).toBe(12.5)
  })
})

describe("categoryProgress", () => {
  const spend = spendByCategory([t("expense", 300, "Bebê"), t("expense", 50, "Mercado")])

  it("calcula percentual e estouro por categoria orçada", () => {
    const rows = categoryProgress(
      [
        { category: "Bebê", monthly_target: 400 },
        { category: "mercado", monthly_target: 40 },
      ],
      spend,
    )
    const bebe = rows.find((r) => r.key === "bebe")!
    expect(bebe).toMatchObject({ spent: 300, target: 400, pct: 75, over: false })
    const mercado = rows.find((r) => r.key === "mercado")!
    expect(mercado).toMatchObject({ spent: 50, pct: 125, over: true })
  })

  it("categoria orçada sem gasto fica em zero", () => {
    const rows = categoryProgress([{ category: "Lazer", monthly_target: 200 }], spend)
    expect(rows[0]).toMatchObject({ spent: 0, pct: 0, over: false })
  })

  it("meta zero não divide por zero", () => {
    const rows = categoryProgress([{ category: "Bebê", monthly_target: 0 }], spend)
    expect(rows[0].pct).toBe(0)
  })
})

describe("knownCategories", () => {
  it("junta transações e orçamentos, sem duplicar por caixa, em ordem alfabética", () => {
    const list = knownCategories(
      [t("expense", 1, "Mercado"), t("expense", 1, "mercado"), t("expense", 1, null)],
      [{ category: "Bebê" }],
    )
    expect(list).toEqual(["Bebê", "Mercado"])
  })
})
