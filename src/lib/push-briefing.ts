export interface BriefingInput {
  /** Tasks com prazo antes de hoje. */
  overdue: number
  /** Títulos das tasks que vencem hoje. */
  dueToday: string[]
  /** Títulos das tasks que vencem amanhã. */
  dueTomorrow: string[]
  /** Consultas nas próximas 24 h. */
  appts: number
}

const MAX_TITLE = 40
const MAX_LISTED = 2
const MAX_BODY = 400

function clip(title: string): string {
  return title.length > MAX_TITLE ? `${title.slice(0, MAX_TITLE - 1).trimEnd()}…` : title
}

function listed(label: string, titles: string[]): string {
  const shown = titles.slice(0, MAX_LISTED).map(clip).join(", ")
  const rest = titles.length - MAX_LISTED
  return `${label}: ${shown}${rest > 0 ? ` (+${rest})` : ""}`
}

/** Texto do push matinal; null quando não há nada a avisar. */
export function buildBriefing(input: BriefingInput): { title: string; body: string } | null {
  const parts: string[] = []
  if (input.dueToday.length > 0) parts.push(listed("Hoje", input.dueToday))
  if (input.dueTomorrow.length > 0) parts.push(listed("Amanhã", input.dueTomorrow))
  if (input.overdue > 0) parts.push(`${input.overdue} ${input.overdue === 1 ? "atrasada" : "atrasadas"}`)
  if (input.appts > 0) parts.push(`${input.appts} ${input.appts === 1 ? "consulta" : "consultas"} nas próximas 24h`)
  if (parts.length === 0) return null
  return { title: "Ops Hub — Briefing", body: parts.join(" · ").slice(0, MAX_BODY) }
}
