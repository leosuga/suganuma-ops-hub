import { describe, it, expect } from "vitest"
import { addDaysStr, addMonthsStr, diffDays, saoPauloDate } from "@/lib/baby/dates"

describe("addDaysStr", () => {
  it("soma dias dentro do mês", () => {
    expect(addDaysStr("2026-10-06", 5)).toBe("2026-10-11")
  })
  it("vira o ano", () => {
    expect(addDaysStr("2026-12-30", 5)).toBe("2027-01-04")
  })
})

describe("addMonthsStr", () => {
  it("soma meses de calendário a partir do nascimento", () => {
    expect(addMonthsStr("2026-10-06", 2)).toBe("2026-12-06")
    expect(addMonthsStr("2026-10-06", 12)).toBe("2027-10-06")
  })
  it("faz clamp no fim do mês (31/jan + 1 mês = 28/fev)", () => {
    expect(addMonthsStr("2026-01-31", 1)).toBe("2026-02-28")
  })
  it("respeita ano bissexto", () => {
    expect(addMonthsStr("2028-01-31", 1)).toBe("2028-02-29")
  })
})

describe("diffDays", () => {
  it("conta dias entre duas datas", () => {
    expect(diffDays("2026-10-06", "2026-10-13")).toBe(7)
  })
  it("é negativo quando a segunda data é anterior", () => {
    expect(diffDays("2026-10-13", "2026-10-06")).toBe(-7)
  })
})

describe("saoPauloDate", () => {
  it("usa o fuso de São Paulo, não UTC", () => {
    // 01:30Z ainda é 22:30 do dia anterior em São Paulo (UTC-3)
    expect(saoPauloDate("2026-10-07T01:30:00Z")).toBe("2026-10-06")
    expect(saoPauloDate("2026-10-06T12:00:00Z")).toBe("2026-10-06")
  })
})
