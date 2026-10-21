import { describe, it, expect } from "vitest"
import { buildWeeklyChecklist } from "@/lib/weekly-review"

describe("buildWeeklyChecklist", () => {
  it("monta as 4 decisões do ritual, na ordem", () => {
    const items = buildWeeklyChecklist({
      inboxPending: 0,
      overdueTasks: 0,
      staleAreas: 0,
      delegatedNoReturn: 0,
    })
    expect(items.map((i) => i.key)).toEqual(["inbox", "overdue", "areas", "delegated"])
  })

  it("tudo ok quando não há pendência", () => {
    const items = buildWeeklyChecklist({
      inboxPending: 0,
      overdueTasks: 0,
      staleAreas: 0,
      delegatedNoReturn: 0,
    })
    expect(items.every((i) => i.ok)).toBe(true)
    expect(items.every((i) => i.count === 0)).toBe(true)
  })

  it("aponta o que está pendente, com a contagem", () => {
    const items = buildWeeklyChecklist({
      inboxPending: 3,
      overdueTasks: 12,
      staleAreas: 0,
      delegatedNoReturn: 1,
    })
    expect(items.find((i) => i.key === "inbox")).toMatchObject({ ok: false, count: 3 })
    expect(items.find((i) => i.key === "overdue")).toMatchObject({ ok: false, count: 12 })
    expect(items.find((i) => i.key === "areas")).toMatchObject({ ok: true, count: 0 })
    expect(items.find((i) => i.key === "delegated")).toMatchObject({ ok: false, count: 1 })
  })

  it("áreas não tem link (a ação fica na própria página)", () => {
    const items = buildWeeklyChecklist({
      inboxPending: 0,
      overdueTasks: 0,
      staleAreas: 2,
      delegatedNoReturn: 0,
    })
    expect(items.find((i) => i.key === "areas")?.href).toBeNull()
    expect(items.find((i) => i.key === "inbox")?.href).toBe("/inbox")
  })
})
