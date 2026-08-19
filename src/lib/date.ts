// Formata como YYYY-MM-DD no fuso de São Paulo. toISOString() usa UTC — às
// 21h-23h59 em São Paulo (UTC-3) isso já vira o dia seguinte em UTC, fazendo
// "hoje" virar amanhã à noite (hábitos, filtro do Cockpit, notificações etc.).
const SAO_PAULO_DATE = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" })

export function today(): string {
  return SAO_PAULO_DATE.format(new Date())
}

export function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function addMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, 1)
}

export function addDays(date: Date, days: number): Date {
  const r = new Date(date)
  r.setDate(r.getDate() + days)
  return r
}

export function startOfWeek(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(date.setDate(diff))
}

export function isoWeekKey(d: Date): string {
  const s = startOfWeek(d)
  return `${String(s.getDate()).padStart(2, "0")}/${String(s.getMonth() + 1).padStart(2, "0")}`
}

export function dateStr(d: Date): string {
  return SAO_PAULO_DATE.format(d)
}
