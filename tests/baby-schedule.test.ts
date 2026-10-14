import { describe, it, expect } from "vitest"
import { buildCareSchedule, dueAtFor, toTaskDraft, CARE_ITEMS, CARE_GROUPS } from "@/lib/baby/care-schedule"
import { taskSchema } from "@/lib/schemas/task"

const BIRTH = "2026-10-06"
const TODAY = "2026-10-13"
const find = (key: string) => {
  const item = buildCareSchedule(BIRTH, TODAY).find((i) => i.key === key)
  if (!item) throw new Error(`item ${key} não existe`)
  return item
}

describe("CARE_ITEMS", () => {
  it("tem chaves únicas", () => {
    const keys = CARE_ITEMS.map((i) => i.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("cobre todos os grupos", () => {
    for (const g of CARE_GROUPS) {
      expect(CARE_ITEMS.some((i) => i.group === g), g).toBe(true)
    }
  })

  it("todo item vira uma task válida no schema do app", () => {
    for (const item of buildCareSchedule(BIRTH, TODAY)) {
      const r = taskSchema.safeParse({
        title: item.title,
        notes: item.notes,
        category: item.category,
        priority: item.priority,
        tags: item.tags,
        recurrence: item.recurrence ?? null,
        due_at: dueAtFor(item.dueDate),
      })
      expect(r.success, `${item.key}: ${JSON.stringify(r.error?.issues)}`).toBe(true)
    }
  })

  it("todo item leva a tag 'bebe' e a do seu grupo", () => {
    for (const item of CARE_ITEMS) {
      expect(item.tags).toContain("bebe")
      expect(item.tags).toContain(item.group)
    }
  })
})

describe("buildCareSchedule (nascimento 2026-10-06)", () => {
  it("calcula triagens em dias a partir do nascimento", () => {
    expect(find("triagem-pezinho").dueDate).toBe("2026-10-10")
  })

  it("calcula consultas e vacinas em meses de calendário", () => {
    expect(find("consulta-1sem").dueDate).toBe("2026-10-11")
    expect(find("consulta-1m").dueDate).toBe("2026-11-06")
    expect(find("vacina-2m").dueDate).toBe("2026-12-06")
    expect(find("vacina-12m").dueDate).toBe("2027-10-06")
  })

  it("marca como passado só o que venceu antes de hoje", () => {
    expect(find("triagem-coracaozinho").isPast).toBe(true)
    expect(find("triagem-pezinho").isPast).toBe(true)
    expect(find("consulta-1m").isPast).toBe(false)
  })

  it("um item que vence hoje ainda não é passado", () => {
    const items = buildCareSchedule(BIRTH, "2026-10-10")
    expect(items.find((i) => i.key === "triagem-pezinho")?.isPast).toBe(false)
  })

  it("devolve ordenado por data e nada antes do nascimento", () => {
    const items = buildCareSchedule(BIRTH, TODAY)
    const dates = items.map((i) => i.dueDate)
    expect([...dates].sort()).toEqual(dates)
    expect(dates[0] >= BIRTH).toBe(true)
  })

  it("prazos legais: certidão no dia 10, plano de saúde antes dos 30 dias", () => {
    expect(find("doc-certidao").dueDate).toBe("2026-10-16")
    expect(find("doc-plano-saude").dueDate <= "2026-11-04").toBe(true)
    expect(find("doc-plano-saude").priority).toBe("urgent")
  })
})

describe("dueAtFor", () => {
  it("fixa meio-dia de São Paulo (15:00Z) para não cair no dia errado", () => {
    expect(dueAtFor("2026-10-10")).toBe("2026-10-10T15:00:00.000Z")
  })
})

describe("toTaskDraft", () => {
  const pezinho = () => find("triagem-pezinho")

  it("item pendente vira task 'todo' com vencimento e projeto", () => {
    const t = toTaskDraft(pezinho(), { done: false, projectId: "proj-1" })
    expect(t.status).toBe("todo")
    expect(t.project_id).toBe("proj-1")
    expect(t.due_at).toBe("2026-10-10T15:00:00.000Z")
    expect(t.completed_at).toBeUndefined()
    expect(t.tags).toEqual(expect.arrayContaining(["bebe", "triagem"]))
  })

  it("item já feito vira 'done' concluída na própria data de vencimento", () => {
    const t = toTaskDraft(pezinho(), { done: true, projectId: "proj-1" })
    expect(t.status).toBe("done")
    expect(t.completed_at).toBe(t.due_at)
  })

  it("preserva recorrência e notas", () => {
    const t = toTaskDraft(find("compra-fraldas"), { done: false, projectId: "p" })
    expect(t.recurrence).toBe("weekly")
    expect(t.notes).toBeTruthy()
  })

  it("não marca como importante nem delega", () => {
    const t = toTaskDraft(pezinho(), { done: false, projectId: "p" })
    expect(t.important).toBe(false)
    expect(t).not.toHaveProperty("delegated_to")
  })
})
