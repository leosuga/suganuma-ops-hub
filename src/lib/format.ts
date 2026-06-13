export function fmtCurrency(n: number, options?: { maximumFractionDigits?: number }): string {
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: options?.maximumFractionDigits,
  })
}

export function fmtShortDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
}

export function fmtShortTime(d: Date): string {
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}
