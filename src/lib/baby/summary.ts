import type { BabyLogRow } from "@/lib/types/baby"
import { addMonthsStr, diffDays, saoPauloDate } from "./dates"

type LogLike = Pick<BabyLogRow, "kind" | "started_at" | "ended_at" | "data">

const DAY_MS = 86_400_000
const MIN_MS = 60_000

export interface Summary24h {
  feeds: number
  lastFeed: { at: string; method?: string; side?: string } | null
  minutesSinceLastFeed: number | null
  /** Lado sugerido para a próxima mamada no peito (oposto ao da última). */
  nextSide: "L" | "R" | null
  wet: number
  dirty: number
  sleepMinutes: number
  sleeping: boolean
  vitDToday: boolean
}

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined
}

/** "7 dias", "1 mês e 3 dias", "2 meses". `todayStr` é a data (YYYY-MM-DD) de hoje em São Paulo. */
export function ageLabel(birthAt: string, todayStr: string): string {
  const birth = saoPauloDate(birthAt)
  const totalDays = diffDays(birth, todayStr)
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  let months = 0
  while (months < 600 && diffDays(addMonthsStr(birth, months + 1), todayStr) >= 0) months++

  if (months === 0) return plural(Math.max(0, totalDays), "dia", "dias")
  const days = diffDays(addMonthsStr(birth, months), todayStr)
  const m = plural(months, "mês", "meses")
  return days > 0 ? `${m} e ${plural(days, "dia", "dias")}` : m
}

/** Variação percentual do peso atual sobre o de nascimento. */
export function weightChangePct(birthG: number | null, currentG: number): number | null {
  if (!birthG) return null
  return ((currentG - birthG) / birthG) * 100
}

export function summarize24h(logs: LogLike[], nowIso: string): Summary24h {
  const now = new Date(nowIso).getTime()
  const windowStart = now - DAY_MS
  const todaySp = saoPauloDate(nowIso)

  let feeds = 0
  let wet = 0
  let dirty = 0
  let sleepMs = 0
  let sleeping = false
  let vitDToday = false
  let lastFeed: LogLike | null = null
  let lastBreast: LogLike | null = null

  for (const log of logs) {
    const start = new Date(log.started_at).getTime()
    const inWindow = start > windowStart && start <= now

    if (log.kind === "feed" && inWindow) {
      feeds++
      if (!lastFeed || start > new Date(lastFeed.started_at).getTime()) lastFeed = log
      const side = str(log.data.side)
      if (log.data.method === "breast" && (side === "L" || side === "R")) {
        if (!lastBreast || start > new Date(lastBreast.started_at).getTime()) lastBreast = log
      }
    } else if (log.kind === "diaper" && inWindow) {
      if (log.data.wet === true) wet++
      if (log.data.dirty === true) dirty++
    } else if (log.kind === "sleep") {
      const end = log.ended_at ? new Date(log.ended_at).getTime() : now
      if (!log.ended_at) sleeping = true
      const from = Math.max(start, windowStart)
      const to = Math.min(end, now)
      if (to > from) sleepMs += to - from
    } else if (log.kind === "med") {
      const name = str(log.data.name) ?? ""
      if (/vit.*d/i.test(name) && saoPauloDate(log.started_at) === todaySp) vitDToday = true
    }
  }

  const lastSide = lastFeed && lastFeed === lastBreast ? str(lastFeed.data.side) : undefined
  return {
    feeds,
    lastFeed: lastFeed
      ? { at: lastFeed.started_at, method: str(lastFeed.data.method), side: str(lastFeed.data.side) }
      : null,
    minutesSinceLastFeed: lastFeed
      ? Math.round((now - new Date(lastFeed.started_at).getTime()) / MIN_MS)
      : null,
    nextSide: lastSide === "L" ? "R" : lastSide === "R" ? "L" : null,
    wet,
    dirty,
    sleepMinutes: Math.round(sleepMs / MIN_MS),
    sleeping,
    vitDToday,
  }
}
