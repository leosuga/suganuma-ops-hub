import { describe, it, expect } from "vitest"
import { sortTasks } from "@/lib/task-sort"

const t = (over: Partial<Parameters<typeof sortTasks>[0][number]> & { id: string }) => ({
  priority: "med",
  important: false,
  due_at: null as string | null,
  created_at: "2026-01-01T00:00:00Z",
  ...over,
})

describe("sortTasks", () => {
  it("'due' preserva a ordem do servidor", () => {
    const list = [t({ id: "b", due_at: "2026-02-01" }), t({ id: "a", due_at: "2026-01-01" })]
    expect(sortTasks(list, "due").map((x) => x.id)).toEqual(["b", "a"])
  })

  it("prioridade: urgent > high > med > low, e o prazo desempata", () => {
    const list = [
      t({ id: "low", priority: "low" }),
      t({ id: "med", priority: "med" }),
      t({ id: "urgent", priority: "urgent", due_at: "2026-12-01" }),
      t({ id: "high", priority: "high" }),
    ]
    expect(sortTasks(list, "priority").map((x) => x.id)).toEqual(["urgent", "high", "med", "low"])
  })

  it("prioridade: prioridade desconhecida cai em 'med'", () => {
    const list = [t({ id: "x", priority: null }), t({ id: "u", priority: "urgent" })]
    expect(sortTasks(list, "priority").map((x) => x.id)).toEqual(["u", "x"])
  })

  it("importante: as importantes primeiro, prazo desempata", () => {
    const list = [
      t({ id: "comum" }),
      t({ id: "imp2", important: true, due_at: "2026-03-01" }),
      t({ id: "imp1", important: true, due_at: "2026-01-01" }),
    ]
    expect(sortTasks(list, "important").map((x) => x.id)).toEqual(["imp1", "imp2", "comum"])
  })

  it("criação: mais recente primeiro", () => {
    const list = [
      t({ id: "velha", created_at: "2026-01-01T00:00:00Z" }),
      t({ id: "nova", created_at: "2026-06-01T00:00:00Z" }),
    ]
    expect(sortTasks(list, "created").map((x) => x.id)).toEqual(["nova", "velha"])
  })

  it("não muta a lista original", () => {
    const list = [t({ id: "b", priority: "low" }), t({ id: "a", priority: "urgent" })]
    sortTasks(list, "priority")
    expect(list.map((x) => x.id)).toEqual(["b", "a"])
  })
})
