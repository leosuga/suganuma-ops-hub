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
