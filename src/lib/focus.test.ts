// Testes da fila FOCO: o ranking e o MOTIVO são a promessa do Cockpit
// ("o que fazer agora"). Um erro aqui muda o que o usuário faz primeiro.
import { describe, it, expect } from "vitest"
import { buildFocus, FOCUS_TIERS, type FocusTask } from "@/lib/focus"

// 21/10/2026 12:00 em São Paulo
const NOW = new Date("2026-10-21T12:00:00-03:00").getTime()
const TODAY = "2026-10-21"

function task(over: Partial<FocusTask> & { id: string }): FocusTask {
  return {
    title: `task ${over.id}`,
    status: "todo",
    priority: "med",
    important: false,
    energy_level: null,
    due_at: null,
    ...over,
  }
}

describe("buildFocus", () => {
  it("task vencida entra como atrasado, com os dias", () => {
    const [item] = buildFocus(
      [task({ id: "a", due_at: "2026-10-18T10:00:00-03:00" })],
      { nowMs: NOW, todayStr: TODAY }
    )
    expect(item.reason).toBe("atrasado 3d")
    expect(item.tone).toBe("danger")
    expect(item.tier).toBe(FOCUS_TIERS.overdue)
  })

  it("task que vence hoje entra como 'vence hoje'", () => {
    const [item] = buildFocus(
      [task({ id: "b", due_at: "2026-10-21T18:00:00-03:00" })],
      { nowMs: NOW, todayStr: TODAY }
    )
    expect(item.reason).toBe("vence hoje")
    expect(item.tone).toBe("amber")
  })

  it("prioridade urgent sem data entra como urgente", () => {
    const [item] = buildFocus([task({ id: "c", priority: "urgent" })], {
      nowMs: NOW,
      todayStr: TODAY,
    })
    expect(item.reason).toBe("urgente")
  })

  it("importante entra como importante", () => {
    const [item] = buildFocus([task({ id: "d", important: true })], {
      nowMs: NOW,
      todayStr: TODAY,
    })
    expect(item.reason).toBe("importante")
    expect(item.tone).toBe("teal")
  })

  it("energia baixa entra como quick win", () => {
    const [item] = buildFocus([task({ id: "e", energy_level: "low" })], {
      nowMs: NOW,
      todayStr: TODAY,
    })
    expect(item.reason).toBe("quick win")
  })

  it("prioridade low sem energia também é quick win (legado do parser antigo)", () => {
    const [item] = buildFocus([task({ id: "f", priority: "low" })], {
      nowMs: NOW,
      todayStr: TODAY,
    })
    expect(item.reason).toBe("quick win")
  })

  it("task concluída nunca entra na fila", () => {
    const focus = buildFocus(
      [task({ id: "g", status: "done", due_at: "2026-10-01T10:00:00-03:00" })],
      { nowMs: NOW, todayStr: TODAY }
    )
    expect(focus).toHaveLength(0)
  })

  it("task sem sinal nenhum não entra (não é ruído)", () => {
    const focus = buildFocus([task({ id: "h" })], { nowMs: NOW, todayStr: TODAY })
    expect(focus).toHaveLength(0)
  })

  it("ordena por tier: vencida > vence hoje > urgente > importante > quick win", () => {
    const focus = buildFocus(
      [
        task({ id: "q", energy_level: "low" }),
        task({ id: "i", important: true }),
        task({ id: "u", priority: "urgent" }),
        task({ id: "t", due_at: "2026-10-21T18:00:00-03:00" }),
        task({ id: "o", due_at: "2026-10-18T10:00:00-03:00" }),
      ],
      { nowMs: NOW, todayStr: TODAY }
    )
    expect(focus.map((f) => f.id)).toEqual(["o", "t", "u", "i", "q"])
  })

  it("dentro do mesmo tier, vence antes sobe", () => {
    const focus = buildFocus(
      [
        task({ id: "depois", due_at: "2026-10-19T10:00:00-03:00" }),
        task({ id: "antes", due_at: "2026-10-10T10:00:00-03:00" }),
      ],
      { nowMs: NOW, todayStr: TODAY }
    )
    expect(focus.map((f) => f.id)).toEqual(["antes", "depois"])
  })

  it("vence hoje NÃO é confundido com atrasada quando a data é mais tarde hoje", () => {
    const focus = buildFocus(
      [task({ id: "x", due_at: "2026-10-21T23:59:00-03:00" })],
      { nowMs: NOW, todayStr: TODAY }
    )
    expect(focus[0].reason).toBe("vence hoje")
  })
})
