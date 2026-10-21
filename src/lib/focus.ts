// Lógica pura da fila FOCO (Cockpit): o que fazer agora, ranqueado e COM
// motivo. Fora do componente de propósito — os testes de DOM só rodam no
// Docker, então tudo que dá para testar em node vira função pura.

import { dateStr } from "@/lib/date"

export type FocusTone = "danger" | "amber" | "teal"

export interface FocusItem<T extends FocusTask = FocusTask> {
  id: string
  title: string
  /** A task original (o componente precisa do objeto para o checkbox). */
  task: T
  /** Por que o item está na fila: "atrasado 3d", "vence hoje", "importante"... */
  reason: string
  tone: FocusTone
  /** 0 = mais urgente. Menor tier = mais alto na fila. */
  tier: number
}

export interface FocusTask {
  id: string
  title: string
  status: string
  priority?: string | null
  important?: boolean | null
  energy_level?: string | null
  due_at?: string | null
}

export const FOCUS_TIERS = {
  overdue: 0,
  dueToday: 1,
  urgent: 2,
  important: 3,
  quickWin: 4,
} as const

const DAY_MS = 86_400_000

/**
 * Monta a fila do dia.
 *
 * Regras (primeira que casa):
 *   1. venceu            → "atrasado Nd" (danger)
 *   2. vence hoje        → "vence hoje"   (amber)
 *   3. prioridade urgent → "urgente"      (danger)
 *   4. importante       → "importante"   (teal)
 *   5. energia baixa    → "quick win"    (teal)
 *   (sem isso, a task não entra no foco)
 *
 * "vence hoje" compara no fuso de São Paulo (mesmo helper do resto do app) —
 * em UTC, à noite, "hoje" viraria "amanhã".
 */
export function buildFocus<T extends FocusTask>(
  tasks: T[],
  opts: { nowMs: number; todayStr: string }
): FocusItem<T>[] {
  const dueById = new Map<string, number | null>()
  const items: FocusItem<T>[] = []

  for (const t of tasks) {
    if (t.status === "done") continue

    const due = t.due_at ? new Date(t.due_at).getTime() : null
    dueById.set(t.id, due)

    let reason: string
    let tone: FocusTone
    let tier: number

    if (due !== null && due < opts.nowMs) {
      const days = Math.max(1, Math.round((opts.nowMs - due) / DAY_MS))
      reason = `atrasado ${days}d`
      tone = "danger"
      tier = FOCUS_TIERS.overdue
    } else if (due !== null && dateStr(new Date(due)) === opts.todayStr) {
      reason = "vence hoje"
      tone = "amber"
      tier = FOCUS_TIERS.dueToday
    } else if (t.priority === "urgent") {
      reason = "urgente"
      tone = "danger"
      tier = FOCUS_TIERS.urgent
    } else if (t.important) {
      reason = "importante"
      tone = "teal"
      tier = FOCUS_TIERS.important
    } else if (t.energy_level === "low" || (t.priority === "low" && !t.energy_level)) {
      reason = "quick win"
      tone = "teal"
      tier = FOCUS_TIERS.quickWin
    } else {
      continue
    }

    items.push({ id: t.id, title: t.title, task: t, reason, tone, tier })
  }

  // Tier primeiro; dentro do tier, a que vence antes sobe; desempate por título.
  return items.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier
    const da = dueById.get(a.id) ?? null
    const db = dueById.get(b.id) ?? null
    if (da !== null && db !== null && da !== db) return da - db
    if (da !== null && db === null) return -1
    if (da === null && db !== null) return 1
    return a.title.localeCompare(b.title)
  })
}
