// Checklist da revisão semanal — as decisões que o ritual pede, com o estado
// calculado. Lógica pura (o componente só renderiza).
//
// A página /review mostra o RESUMO da semana ("o que aconteceu"). O checklist
// responde "o que revisar AGORA" — sem isso, a revisão é consulta e o ritual
// não se sustenta (a pesquisa de GTD é clara: sem as respostas em <30s, a
// revisão semanal deixa de acontecer).

export type ChecklistKey = "inbox" | "overdue" | "areas" | "delegated"

export interface ChecklistInput {
  /** Itens do inbox ainda não triados */
  inboxPending: number
  /** Tasks pendentes com prazo vencido */
  overdueTasks: number
  /** Notas de área sem revisão há mais de 30 dias */
  staleAreas: number
  /** Tasks delegadas a alguém sem data de retorno */
  delegatedNoReturn: number
}

export interface ChecklistItem {
  key: ChecklistKey
  label: string
  /** O que está faltando (0 = ok) */
  count: number
  ok: boolean
  /** Detalhe curto do que é */
  hint: string
  /** Para onde ir (null = não há link; a ação fica na própria página) */
  href: string | null
}

export function buildWeeklyChecklist(input: ChecklistInput): ChecklistItem[] {
  return [
    {
      key: "inbox",
      label: "INBOX ZERADO",
      count: input.inboxPending,
      ok: input.inboxPending === 0,
      hint: "itens para triar",
      href: "/inbox",
    },
    {
      key: "overdue",
      label: "SEM ATRASADAS",
      count: input.overdueTasks,
      ok: input.overdueTasks === 0,
      hint: "tasks fora do prazo",
      href: "/tasks",
    },
    {
      key: "areas",
      label: "ÁREAS REVISADAS",
      count: input.staleAreas,
      ok: input.staleAreas === 0,
      hint: "áreas sem revisão >30d",
      href: null,
    },
    {
      key: "delegated",
      label: "DELEGADAS COM RETORNO",
      count: input.delegatedNoReturn,
      ok: input.delegatedNoReturn === 0,
      hint: "sem data de retorno",
      href: "/tasks",
    },
  ]
}
