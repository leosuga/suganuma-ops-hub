import { describe, it, expect } from "vitest"
import { normalizeAgentLog } from "@/lib/baby/agent"

const CHILD = "3f0f7a52-6d0c-4a43-9d57-0f6c1d2b9a10"

describe("normalizeAgentLog", () => {
  it("injeta o child_id do dono quando o agente não manda", () => {
    const r = normalizeAgentLog({ kind: "feed", data: { method: "breast", side: "L" } }, CHILD)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.child_id).toBe(CHILD)
  })

  it("aceita `at` como apelido amigável de started_at", () => {
    const r = normalizeAgentLog(
      { kind: "diaper", at: "2026-10-13T06:00:00Z", data: { wet: true, dirty: false } },
      CHILD,
    )
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.started_at).toBe("2026-10-13T06:00:00Z")
      expect(r.data).not.toHaveProperty("at")
    }
  })

  it("o child_id do dono prevalece sobre um child_id vindo no corpo", () => {
    const outro = "11111111-1111-4111-8111-111111111111"
    const r = normalizeAgentLog({ kind: "sleep", child_id: outro, data: {} }, CHILD)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.child_id).toBe(CHILD)
  })

  it("rejeita payload inválido (mamada sem método)", () => {
    expect(normalizeAgentLog({ kind: "feed", data: {} }, CHILD).success).toBe(false)
  })

  it("rejeita kind desconhecido e corpo que não é objeto", () => {
    expect(normalizeAgentLog({ kind: "banho", data: {} }, CHILD).success).toBe(false)
    expect(normalizeAgentLog("oi", CHILD).success).toBe(false)
    expect(normalizeAgentLog(null, CHILD).success).toBe(false)
  })

  it("rejeita horário em formato inválido", () => {
    const r = normalizeAgentLog({ kind: "sleep", at: "ontem à noite", data: {} }, CHILD)
    expect(r.success).toBe(false)
  })
})
