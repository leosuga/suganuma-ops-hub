// Aritmética de datas YYYY-MM-DD em UTC, sem depender do fuso do navegador ou
// do servidor (o container roda em UTC; o usuário vive em São Paulo).

const SAO_PAULO_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" })

function parts(d: string): [number, number, number] {
  const [y, m, day] = d.split("-").map(Number)
  return [y, m, day]
}

function fmt(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function addDaysStr(d: string, days: number): string {
  const [y, m, day] = parts(d)
  return fmt(new Date(Date.UTC(y, m - 1, day + days)))
}

/** Soma meses de calendário; dia que não existe no mês de destino vira o último dia dele. */
export function addMonthsStr(d: string, months: number): string {
  const [y, m, day] = parts(d)
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate()
  return fmt(new Date(Date.UTC(y, m - 1 + months, Math.min(day, lastDay))))
}

export function diffDays(from: string, to: string): number {
  const [fy, fm, fd] = parts(from)
  const [ty, tm, td] = parts(to)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

/** Data (YYYY-MM-DD) de um instante no fuso de São Paulo. */
export function saoPauloDate(iso: string): string {
  return SAO_PAULO_DATE.format(new Date(iso))
}
