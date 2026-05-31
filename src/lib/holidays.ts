// Brazilian holidays 2026
export const BRAZIL_HOLIDAYS_2026: string[] = [
  "2026-01-01",
  "2026-02-14",
  "2026-02-15",
  "2026-04-03",
  "2026-04-21",
  "2026-05-01",
  "2026-06-04",
  "2026-09-07",
  "2026-10-12",
  "2026-11-02",
  "2026-11-15",
  "2026-12-25",
]

export const HOLIDAY_LABELS: Record<string, string> = {
  "2026-01-01": "Ano Novo",
  "2026-02-14": "Carnaval",
  "2026-02-15": "Carnaval",
  "2026-04-03": "Sexta-feira Santa",
  "2026-04-21": "Tiradentes",
  "2026-05-01": "Dia do Trabalho",
  "2026-06-04": "Corpus Christi",
  "2026-09-07": "Independência",
  "2026-10-12": "Nossa Senhora",
  "2026-11-02": "Finados",
  "2026-11-15": "República",
  "2026-12-25": "Natal",
}

export function isHoliday(dateStr: string): boolean {
  return BRAZIL_HOLIDAYS_2026.includes(dateStr)
}

export function getHolidayLabel(dateStr: string): string | undefined {
  return HOLIDAY_LABELS[dateStr]
}
