export const ANNUAL_COLORS = [
  "#3B82F6",
  "#EF4444",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#06B6D4",
  "#F97316",
  "#84CC16",
  "#6366F1",
  "#14B8A6",
  "#E11D48",
] as const

export type AnnualColor = (typeof ANNUAL_COLORS)[number]

export function nextColor(index: number): AnnualColor {
  return ANNUAL_COLORS[index % ANNUAL_COLORS.length]
}

export const COLOR_LABELS: Record<string, string> = {
  "#3B82F6": "Trabalho",
  "#EF4444": "Urgente",
  "#10B981": "Saúde",
  "#F59E0B": "Pessoal",
  "#8B5CF6": "Estudo",
  "#EC4899": "Lazer",
  "#06B6D4": "Financeiro",
  "#F97316": "Viagem",
  "#84CC16": "Casa",
  "#6366F1": "Família",
  "#14B8A6": "Projeto",
  "#E11D48": "Outro",
}
