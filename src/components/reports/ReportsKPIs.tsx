export function ReportsKPIs({
  rate,
  done,
  total,
  overdue,
  balance,
  income,
  expense,
  maxStreak,
  activeHabits,
  fmt,
}: {
  rate: number
  done: number
  total: number
  overdue: number
  balance: number
  income: number
  expense: number
  maxStreak: number
  activeHabits: number
  fmt: (n: number) => string
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div className="border border-border bg-surface rounded-sm p-4">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-1">
          TASKS – TAXA
        </span>
        <span className="text-xl font-mono font-semibold text-on-surface block">{rate}%</span>
        <span className="text-[10px] font-mono text-on-surface/40 block mt-1">{done}/{total} concluídas</span>
      </div>

      <div className="border border-border bg-surface rounded-sm p-4">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-1">
          TASKS – ATRASADAS
        </span>
        <span className={`text-xl font-mono font-semibold block ${overdue > 0 ? "text-danger" : "text-on-surface"}`}>{overdue}</span>
        <span className="text-[10px] font-mono text-on-surface/40 block mt-1">pendências críticas</span>
      </div>

      <div className="border border-border bg-surface rounded-sm p-4">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-1">
          FINANCEIRO – SALDO
        </span>
        <span className={`text-xl font-mono font-semibold block ${balance >= 0 ? "text-teal" : "text-danger"}`}>{fmt(balance)}</span>
        <span className="text-[10px] font-mono text-on-surface/40 block mt-1">{fmt(income)} rec / {fmt(expense)} desp</span>
      </div>

      <div className="border border-border bg-surface rounded-sm p-4">
        <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-1">
          HÁBITOS – STREAK MÁX
        </span>
        <span className="text-xl font-mono font-semibold text-health block">{maxStreak}d</span>
        <span className="text-[10px] font-mono text-on-surface/40 block mt-1">{activeHabits} ativos</span>
      </div>
    </div>
  )
}
