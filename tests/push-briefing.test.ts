import { describe, it, expect } from "vitest"
import { buildBriefing } from "@/lib/push-briefing"

const none = { overdue: 0, dueToday: [], dueTomorrow: [], appts: 0 }

describe("buildBriefing", () => {
  it("devolve null quando não há nada a avisar", () => {
    expect(buildBriefing(none)).toBeNull()
  })

  it("lista até 2 títulos de hoje e resume o resto", () => {
    expect(buildBriefing({ ...none, dueToday: ["Vacina 2m"] })?.body).toBe("Hoje: Vacina 2m")
    expect(buildBriefing({ ...none, dueToday: ["A", "B"] })?.body).toBe("Hoje: A, B")
    expect(buildBriefing({ ...none, dueToday: ["A", "B", "C", "D"] })?.body).toBe("Hoje: A, B (+2)")
  })

  it("avisa o que vence amanhã (o lembrete antes do prazo)", () => {
    expect(buildBriefing({ ...none, dueTomorrow: ["Pediatra 1 mês"] })?.body).toBe("Amanhã: Pediatra 1 mês")
  })

  it("concorda o plural de atrasadas e consultas", () => {
    expect(buildBriefing({ ...none, overdue: 1 })?.body).toBe("1 atrasada")
    expect(buildBriefing({ ...none, overdue: 3 })?.body).toBe("3 atrasadas")
    expect(buildBriefing({ ...none, appts: 1 })?.body).toBe("1 consulta nas próximas 24h")
    expect(buildBriefing({ ...none, appts: 2 })?.body).toBe("2 consultas nas próximas 24h")
  })

  it("combina na ordem hoje · amanhã · atrasadas · consultas", () => {
    const r = buildBriefing({ overdue: 2, dueToday: ["A"], dueTomorrow: ["B"], appts: 1 })
    expect(r?.body).toBe("Hoje: A · Amanhã: B · 2 atrasadas · 1 consulta nas próximas 24h")
    expect(r?.title).toBe("Ops Hub — Briefing")
  })

  it("trunca títulos longos e respeita o limite do corpo do push", () => {
    const long = "Vacinas de 6 meses: hexavalente (3ª), pneumocócica (conforme esquema) e influenza (1ª)"
    const r = buildBriefing({ ...none, dueToday: [long, long, long] })
    expect(r?.body).toContain("…")
    expect(r!.body.length).toBeLessThanOrEqual(400)
  })
})
