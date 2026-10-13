import type { BabyLog } from "@/lib/schemas/baby"
import type { BabyLogRow } from "@/lib/types/baby"

// Payloads do registro de 1 toque. Sem started_at: o banco usa now(), então o
// horário é o do toque (corrige-se depois no EditBabyLogDialog).

export function feedBreastLog(childId: string, side: "L" | "R"): BabyLog {
  return { child_id: childId, kind: "feed", data: { method: "breast", side } }
}

export function feedBottleLog(
  childId: string,
  ml: number,
  milk: "breast_milk" | "formula" = "breast_milk",
): BabyLog {
  return { child_id: childId, kind: "feed", data: { method: "bottle", ml, milk } }
}

export function diaperLog(childId: string, what: "wet" | "dirty" | "both"): BabyLog {
  return {
    child_id: childId,
    kind: "diaper",
    data: { wet: what !== "dirty", dirty: what !== "wet" },
  }
}

export function sleepStartLog(childId: string): BabyLog {
  return { child_id: childId, kind: "sleep", data: {} }
}

export function medLog(childId: string, name: string, dose?: string): BabyLog {
  return { child_id: childId, kind: "med", data: dose ? { name, dose } : { name } }
}

export function vitaminDLog(childId: string): BabyLog {
  return medLog(childId, "Vitamina D")
}

// ---------------------------------------------------------------- formatação

const CLOCK = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function formatClock(iso: string): string {
  return CLOCK.format(new Date(iso))
}

// O Brasil não tem horário de verão desde 2019, então UTC-3 é fixo.
const SP_OFFSET_MS = -3 * 3_600_000

/** ISO → valor de <input type="datetime-local"> no horário de São Paulo. */
export function toLocalInput(iso: string): string {
  return new Date(new Date(iso).getTime() + SP_OFFSET_MS).toISOString().slice(0, 16)
}

/** Valor de <input type="datetime-local"> (horário de São Paulo) → ISO UTC; null se inválido. */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const ms = new Date(`${value}:00.000Z`).getTime() - SP_OFFSET_MS
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** 45 → "45 min"; 60 → "1h"; 130 → "2h10". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`
}

/** 0 → "agora"; 40 → "há 40 min"; 135 → "há 2h15". */
export function formatSince(minutes: number): string {
  return minutes <= 0 ? "agora" : `há ${formatDuration(minutes)}`
}

type LogLike = Pick<BabyLogRow, "kind" | "started_at" | "ended_at" | "data">

const SIDE_LABEL: Record<string, string> = { L: "E", R: "D", both: "ambos" }

/** Descrição de uma linha da timeline. Tolera `data` malformado (coluna jsonb). */
export function formatLogLine(log: LogLike): string {
  const d = log.data
  switch (log.kind) {
    case "feed": {
      if (d.method === "breast") {
        const side = typeof d.side === "string" ? SIDE_LABEL[d.side] : undefined
        return side ? `Mamou · peito ${side}` : "Mamou · peito"
      }
      if (d.method === "bottle") {
        return typeof d.ml === "number" ? `Mamadeira · ${d.ml} ml` : "Mamadeira"
      }
      return "Mamada"
    }
    case "diaper": {
      if (d.wet === true && d.dirty === true) return "Fralda · xixi + cocô"
      if (d.dirty === true) return "Fralda · cocô"
      if (d.wet === true) return "Fralda · xixi"
      return "Fralda"
    }
    case "sleep": {
      if (!log.ended_at) return "Sono · em andamento"
      const min = Math.round((new Date(log.ended_at).getTime() - new Date(log.started_at).getTime()) / 60_000)
      return `Sono · ${formatDuration(Math.max(0, min))}`
    }
    case "med":
      return typeof d.name === "string" ? `Remédio · ${d.name}` : "Remédio"
    case "growth": {
      const parts: string[] = []
      if (typeof d.weight_g === "number") parts.push(`${d.weight_g} g`)
      if (typeof d.length_cm === "number") parts.push(`${d.length_cm} cm`)
      if (typeof d.head_cm === "number") parts.push(`PC ${d.head_cm} cm`)
      return parts.length ? `Medida · ${parts.join(" · ")}` : "Medida"
    }
    case "temp":
      return typeof d.celsius === "number"
        ? `Temperatura · ${String(d.celsius).replace(".", ",")} °C`
        : "Temperatura"
    default:
      return "Nota"
  }
}
