import { describe, it, expect } from "vitest"
import { buildBills, billsSummary, dueDateFor, periodKey, type RecurringBill } from "@/lib/bills"

const bill = (over: Partial<RecurringBill> & { id: string }): RecurringBill => ({
  description: `conta ${over.id}`,
  amount: 100,
  kind: "expense",
  category: null,
  account_id: null,
  day_of_month: 10,
  active: true,
  ...over,
})

describe("dueDateFor", () => {
  it("usa o dia do mês quando existe", () => {
    expect(dueDateFor(2026, 10, 5)).toBe("2026-10-05")
    expect(dueDateFor(2026, 12, 31)).toBe("2026-12-31")
  })

  it("clampa dia 31 em fevereiro (ano normal)", () => {
    expect(dueDateFor(2026, 2, 31)).toBe("2026-02-28")
  })

  it("clampa dia 31 em fevereiro (ano bissexto)", () => {
    expect(dueDateFor(2028, 2, 31)).toBe("2028-02-29")
  })

  it("clampa dia 30 em abril", () => {
    expect(dueDateFor(2026, 4, 30)).toBe("2026-04-30")
    expect(dueDateFor(2026, 4, 31)).toBe("2026-04-30")
  })
})

describe("periodKey", () => {
  it("formata YYYY-MM", () => {
    expect(periodKey(2026, 3)).toBe("2026-03")
    expect(periodKey(2026, 12)).toBe("2026-12")
  })
})

describe("buildBills", () => {
  const opts = { year: 2026, month: 10, today: "2026-10-08" }

  it("projeta as contas do mês com vencimento e dias restantes", () => {
    const views = buildBills([bill({ id: "a", day_of_month: 10 })], [], opts)
    expect(views).toHaveLength(1)
    expect(views[0].due_on).toBe("2026-10-10")
    expect(views[0].days_until).toBe(2)
    expect(views[0].paid).toBe(false)
  })

  it("ignora contas inativas", () => {
    const views = buildBills([bill({ id: "a", active: false })], [], opts)
    expect(views).toHaveLength(0)
  })

  it("marca como paga quando há pagamento no período", () => {
    const views = buildBills(
      [bill({ id: "a" })],
      [{ recurring_id: "a", period: "2026-10", paid_at: "2026-10-05T10:00:00Z" }],
      opts
    )
    expect(views[0].paid).toBe(true)
    expect(views[0].paid_at).toBe("2026-10-05T10:00:00Z")
  })

  it("pagamento de outro mês NÃO marca este (pagamento é por período)", () => {
    const views = buildBills(
      [bill({ id: "a" })],
      [{ recurring_id: "a", period: "2026-09", paid_at: "2026-09-10T10:00:00Z" }],
      opts
    )
    expect(views[0].paid).toBe(false)
  })

  it("conta vencida tem days_until negativo", () => {
    const views = buildBills([bill({ id: "a", day_of_month: 1 })], [], opts)
    expect(views[0].days_until).toBe(-7)
  })

  it("ordena: não pagas primeiro (por vencimento), pagas no fim", () => {
    const views = buildBills(
      [
        bill({ id: "paga", day_of_month: 3 }),
        bill({ id: "vence10", day_of_month: 10 }),
        bill({ id: "vence5", day_of_month: 5 }),
      ],
      [{ recurring_id: "paga", period: "2026-10", paid_at: "2026-10-03T00:00:00Z" }],
      opts
    )
    expect(views.map((v) => v.id)).toEqual(["vence5", "vence10", "paga"])
  })
})

describe("billsSummary", () => {
  const opts = { year: 2026, month: 10, today: "2026-10-08" }

  it("soma o que falta pagar, conta vencidas e o que vence já", () => {
    const views = buildBills(
      [
        bill({ id: "a", amount: 100, day_of_month: 1 }),   // vencida
        bill({ id: "b", amount: 200, day_of_month: 8 }),   // vence hoje
        bill({ id: "c", amount: 50, day_of_month: 20 }),   // depois
        bill({ id: "d", amount: 300, day_of_month: 5 }),   // paga
      ],
      [{ recurring_id: "d", period: "2026-10", paid_at: "2026-10-05T00:00:00Z" }],
      opts
    )
    const s = billsSummary(views)
    expect(s.totalDue).toBe(350)
    expect(s.totalPaid).toBe(300)
    expect(s.unpaidCount).toBe(3)
    expect(s.overdueCount).toBe(1)
    expect(s.dueSoonCount).toBe(1) // vence hoje
  })

  it("ignora receitas na soma de despesas", () => {
    const views = buildBills([bill({ id: "r", kind: "income", amount: 999 })], [], opts)
    expect(billsSummary(views).totalDue).toBe(0)
  })
})
