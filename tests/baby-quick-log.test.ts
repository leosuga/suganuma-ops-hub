import { describe, it, expect } from "vitest"
import {
  feedBreastLog,
  feedBottleLog,
  diaperLog,
  sleepStartLog,
  vitaminDLog,
  formatLogLine,
  formatDuration,
  formatSince,
  formatClock,
  toLocalInput,
  fromLocalInput,
} from "@/lib/baby/quick-log"
import { babyLogSchema } from "@/lib/schemas/baby"

const CHILD = "3f0f7a52-6d0c-4a43-9d57-0f6c1d2b9a10"

describe("payloads do registro rápido", () => {
  it("todos passam no schema que o servidor e o MCP usam", () => {
    const payloads = [
      feedBreastLog(CHILD, "L"),
      feedBreastLog(CHILD, "R"),
      feedBottleLog(CHILD, 60),
      feedBottleLog(CHILD, 90, "formula"),
      diaperLog(CHILD, "wet"),
      diaperLog(CHILD, "dirty"),
      diaperLog(CHILD, "both"),
      sleepStartLog(CHILD),
      vitaminDLog(CHILD),
    ]
    for (const p of payloads) {
      expect(babyLogSchema.safeParse(p).success, JSON.stringify(p)).toBe(true)
    }
  })

  it("fralda 'both' marca xixi e cocô; 'wet' marca só xixi", () => {
    expect(diaperLog(CHILD, "both").data).toEqual({ wet: true, dirty: true })
    expect(diaperLog(CHILD, "wet").data).toEqual({ wet: true, dirty: false })
  })

  it("não envia started_at: o banco usa now()", () => {
    expect(feedBreastLog(CHILD, "L")).not.toHaveProperty("started_at")
  })
})

describe("formatação", () => {
  it("formatDuration", () => {
    expect(formatDuration(45)).toBe("45 min")
    expect(formatDuration(60)).toBe("1h")
    expect(formatDuration(130)).toBe("2h10")
  })

  it("formatSince", () => {
    expect(formatSince(0)).toBe("agora")
    expect(formatSince(40)).toBe("há 40 min")
    expect(formatSince(135)).toBe("há 2h15")
  })

  it("formatClock usa o fuso de São Paulo", () => {
    expect(formatClock("2026-10-13T15:00:00Z")).toBe("12:00")
    expect(formatClock("2026-10-13T01:30:00Z")).toBe("22:30")
  })

  it("formatLogLine descreve cada tipo", () => {
    const row = (kind: string, data: Record<string, unknown>, ended: string | null = null) => ({
      kind: kind as never,
      started_at: "2026-10-13T15:00:00Z",
      ended_at: ended,
      data,
    })
    expect(formatLogLine(row("feed", { method: "breast", side: "L" }))).toBe("Mamou · peito E")
    expect(formatLogLine(row("feed", { method: "bottle", ml: 60 }))).toBe("Mamadeira · 60 ml")
    expect(formatLogLine(row("diaper", { wet: true, dirty: true }))).toBe("Fralda · xixi + cocô")
    expect(formatLogLine(row("diaper", { wet: false, dirty: true }))).toBe("Fralda · cocô")
    expect(formatLogLine(row("sleep", {}))).toBe("Sono · em andamento")
    expect(formatLogLine(row("sleep", {}, "2026-10-13T17:10:00Z"))).toBe("Sono · 2h10")
    expect(formatLogLine(row("med", { name: "Vitamina D" }))).toBe("Remédio · Vitamina D")
    expect(formatLogLine(row("growth", { weight_g: 3250 }))).toBe("Medida · 3250 g")
    expect(formatLogLine(row("temp", { celsius: 37.8 }))).toBe("Temperatura · 37,8 °C")
  })

  it("formatLogLine não estoura com data malformada", () => {
    const bad = { kind: "feed" as const, started_at: "2026-10-13T15:00:00Z", ended_at: null, data: { method: 42 } }
    expect(formatLogLine(bad)).toBe("Mamada")
  })
})

describe("datetime-local <-> ISO (São Paulo, UTC-3 fixo)", () => {
  it("toLocalInput mostra o horário de São Paulo", () => {
    expect(toLocalInput("2026-10-13T15:00:00Z")).toBe("2026-10-13T12:00")
    expect(toLocalInput("2026-10-07T01:30:00Z")).toBe("2026-10-06T22:30")
  })

  it("fromLocalInput volta para ISO UTC", () => {
    expect(fromLocalInput("2026-10-13T12:00")).toBe("2026-10-13T15:00:00.000Z")
    expect(fromLocalInput("2026-10-06T22:30")).toBe("2026-10-07T01:30:00.000Z")
  })

  it("é inversa de toLocalInput", () => {
    const iso = "2026-10-06T14:35:00.000Z"
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso)
  })

  it("fromLocalInput devolve null para entrada inválida", () => {
    expect(fromLocalInput("")).toBeNull()
    expect(fromLocalInput("abc")).toBeNull()
  })
})
