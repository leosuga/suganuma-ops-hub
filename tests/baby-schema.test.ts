import { describe, it, expect } from "vitest"
import { babyLogSchema, childSchema } from "@/lib/schemas/baby"

const CHILD_ID = "3f0f7a52-6d0c-4a43-9d57-0f6c1d2b9a10"
const base = { child_id: CHILD_ID }

describe("babyLogSchema", () => {
  it("aceita mamada no peito com lado", () => {
    const r = babyLogSchema.safeParse({ ...base, kind: "feed", data: { method: "breast", side: "L" } })
    expect(r.success).toBe(true)
  })

  it("aceita mamadeira com ml", () => {
    const r = babyLogSchema.safeParse({ ...base, kind: "feed", data: { method: "bottle", ml: 60 } })
    expect(r.success).toBe(true)
  })

  it("rejeita mamada sem método", () => {
    expect(babyLogSchema.safeParse({ ...base, kind: "feed", data: {} }).success).toBe(false)
  })

  it("rejeita mamadeira com ml não positivo", () => {
    const r = babyLogSchema.safeParse({ ...base, kind: "feed", data: { method: "bottle", ml: 0 } })
    expect(r.success).toBe(false)
  })

  it("fralda exige xixi ou cocô", () => {
    expect(babyLogSchema.safeParse({ ...base, kind: "diaper", data: { wet: false, dirty: false } }).success).toBe(false)
    expect(babyLogSchema.safeParse({ ...base, kind: "diaper", data: { wet: true, dirty: false } }).success).toBe(true)
  })

  it("medida exige ao menos uma grandeza", () => {
    expect(babyLogSchema.safeParse({ ...base, kind: "growth", data: {} }).success).toBe(false)
    expect(babyLogSchema.safeParse({ ...base, kind: "growth", data: { weight_g: 3250 } }).success).toBe(true)
  })

  it("remédio exige nome", () => {
    expect(babyLogSchema.safeParse({ ...base, kind: "med", data: {} }).success).toBe(false)
    expect(babyLogSchema.safeParse({ ...base, kind: "med", data: { name: "Vitamina D" } }).success).toBe(true)
  })

  it("aceita sono em andamento (sem ended_at)", () => {
    expect(babyLogSchema.safeParse({ ...base, kind: "sleep", data: {} }).success).toBe(true)
  })

  it("rejeita kind desconhecido", () => {
    expect(babyLogSchema.safeParse({ ...base, kind: "banho", data: {} }).success).toBe(false)
  })
})

describe("childSchema", () => {
  it("exige nome e nascimento", () => {
    expect(childSchema.safeParse({ name: "", birth_at: "2026-10-06T14:00:00Z" }).success).toBe(false)
    expect(childSchema.safeParse({ name: "Ana", birth_at: "2026-10-06T14:00:00Z" }).success).toBe(true)
  })
})
