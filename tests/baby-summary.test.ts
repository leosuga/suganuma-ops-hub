import { describe, it, expect } from "vitest"
import { ageLabel, ageShort, summarize24h, weightChangePct } from "@/lib/baby/summary"

// "agora" fixo: 2026-10-13 12:00 em São Paulo = 15:00Z
const NOW = "2026-10-13T15:00:00Z"
const at = (iso: string) => ({ started_at: iso, ended_at: null as string | null })

describe("ageLabel", () => {
  const birth = "2026-10-06T14:00:00Z"
  it("usa dias na primeira fase", () => {
    expect(ageLabel(birth, "2026-10-07")).toBe("1 dia")
    expect(ageLabel(birth, "2026-10-13")).toBe("7 dias")
  })
  it("mistura meses e dias depois do primeiro mês", () => {
    expect(ageLabel(birth, "2026-11-09")).toBe("1 mês e 3 dias")
  })
  it("omite os dias quando fecha o mês", () => {
    expect(ageLabel(birth, "2026-11-06")).toBe("1 mês")
    expect(ageLabel(birth, "2026-12-06")).toBe("2 meses")
  })
})

describe("ageShort", () => {
  const birth = "2026-10-06T14:00:00Z"
  it("compacta para cards: dias, depois meses e dias", () => {
    expect(ageShort(birth, "2026-10-13")).toBe("7d")
    expect(ageShort(birth, "2026-11-09")).toBe("1m 3d")
    expect(ageShort(birth, "2026-12-06")).toBe("2m")
  })
})

describe("weightChangePct", () => {
  it("calcula variação percentual sobre o peso de nascimento", () => {
    expect(weightChangePct(3200, 3040)).toBeCloseTo(-5, 5)
    expect(weightChangePct(3200, 3360)).toBeCloseTo(5, 5)
  })
  it("devolve null sem peso de nascimento", () => {
    expect(weightChangePct(null, 3000)).toBeNull()
  })
})

describe("summarize24h", () => {
  it("conta mamadas, fraldas e ignora o que passou de 24h", () => {
    const s = summarize24h(
      [
        { kind: "feed", ...at("2026-10-13T14:00:00Z"), data: { method: "breast", side: "L" } },
        { kind: "feed", ...at("2026-10-13T10:00:00Z"), data: { method: "breast", side: "R" } },
        { kind: "feed", ...at("2026-10-11T10:00:00Z"), data: { method: "breast", side: "R" } },
        { kind: "diaper", ...at("2026-10-13T13:00:00Z"), data: { wet: true, dirty: false } },
        { kind: "diaper", ...at("2026-10-13T11:00:00Z"), data: { wet: true, dirty: true } },
      ],
      NOW,
    )
    expect(s.feeds).toBe(2)
    expect(s.wet).toBe(2)
    expect(s.dirty).toBe(1)
  })

  it("informa a última mamada e sugere o lado oposto", () => {
    const s = summarize24h(
      [
        { kind: "feed", ...at("2026-10-13T10:00:00Z"), data: { method: "breast", side: "R" } },
        { kind: "feed", ...at("2026-10-13T12:45:00Z"), data: { method: "breast", side: "L" } },
      ],
      NOW,
    )
    expect(s.lastFeed?.side).toBe("L")
    expect(s.minutesSinceLastFeed).toBe(135)
    expect(s.nextSide).toBe("R")
  })

  it("não sugere lado quando a última mamada foi mamadeira", () => {
    const s = summarize24h(
      [{ kind: "feed", ...at("2026-10-13T14:00:00Z"), data: { method: "bottle", ml: 60 } }],
      NOW,
    )
    expect(s.nextSide).toBeNull()
  })

  it("soma sono e conta o sono em aberto até agora", () => {
    const s = summarize24h(
      [
        { kind: "sleep", started_at: "2026-10-13T08:00:00Z", ended_at: "2026-10-13T10:00:00Z", data: {} },
        { kind: "sleep", started_at: "2026-10-13T14:00:00Z", ended_at: null, data: {} },
      ],
      NOW,
    )
    expect(s.sleepMinutes).toBe(120 + 60)
    expect(s.sleeping).toBe(true)
  })

  it("recorta o sono que começou antes da janela de 24h", () => {
    const s = summarize24h(
      [{ kind: "sleep", started_at: "2026-10-12T14:00:00Z", ended_at: "2026-10-12T16:00:00Z", data: {} }],
      NOW,
    )
    // a janela começa em 2026-10-12T15:00Z, então só 1h cai dentro
    expect(s.sleepMinutes).toBe(60)
  })

  it("marca a vitamina D como dada só no dia de hoje (fuso São Paulo)", () => {
    const given = summarize24h(
      [{ kind: "med", ...at("2026-10-13T11:00:00Z"), data: { name: "Vitamina D" } }],
      NOW,
    )
    expect(given.vitDToday).toBe(true)
    const yesterday = summarize24h(
      [{ kind: "med", ...at("2026-10-12T18:00:00Z"), data: { name: "vit d" } }],
      NOW,
    )
    expect(yesterday.vitDToday).toBe(false)
  })

  it("tolera data malformada sem estourar", () => {
    const s = summarize24h([{ kind: "feed", ...at("2026-10-13T14:00:00Z"), data: { method: 42 } }], NOW)
    expect(s.feeds).toBe(1)
    expect(s.nextSide).toBeNull()
  })
})
