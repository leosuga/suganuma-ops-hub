import { SimpleBarChart } from "./SimpleBarChart"

interface TrendSectionProps {
  title: string
  data: { [key: string]: number | string; label: string }[]
  keys: string[]
  colors: string[]
  labels: string[]
}

function TrendSection({ title, data, keys, colors, labels }: TrendSectionProps) {
  return (
    <div className="border border-border bg-surface rounded-sm p-4">
      <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase block mb-3">
        {title}
      </span>
      <div className="mb-4">
        <SimpleBarChart data={data} keys={keys} colors={colors} labels={labels} />
      </div>
      <div className="flex gap-4 justify-center">
        {labels.map((label, i) => (
          <span key={label} className="text-[9px] font-mono text-on-surface/30 flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-sm" style={{ backgroundColor: colors[i] }} /> {label}
          </span>
        ))}
      </div>
    </div>
  )
}

export function TaskTrendSection({
  data,
}: {
  data: { label: string; completed: number; created: number }[]
}) {
  return (
    <TrendSection
      title="TASKS – CONCLUÍDAS POR SEMANA"
      data={data}
      keys={["completed", "created"]}
      colors={["#55D7ED", "rgba(222,227,229,0.15)"]}
      labels={["Concluídas", "Criadas"]}
    />
  )
}

export function FinanceTrendSection({
  data,
}: {
  data: { label: string; income: number; expense: number }[]
}) {
  return (
    <TrendSection
      title="FINANCEIRO – FLUXO MENSAL"
      data={data}
      keys={["income", "expense"]}
      colors={["#55D7ED", "#FFB4AB"]}
      labels={["Receita", "Despesa"]}
    />
  )
}
