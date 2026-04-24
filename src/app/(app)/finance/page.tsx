export default function FinancePage() {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
          FINANCE HUB
        </h1>
        <p className="text-[10px] font-mono text-on-surface/30 mt-0.5">
          Gestão financeira pessoal
        </p>
      </div>

      {/* Coming soon card */}
      <div className="border border-border bg-surface rounded-sm p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-3 h-3 rounded-full bg-amber/30 border border-amber/40" />
        <div>
          <p className="text-[12px] font-mono text-on-surface/60">
            Finance Hub — Fase 2
          </p>
          <p className="text-[10px] font-mono text-on-surface/30 mt-1">
            Transações manuais, import CSV e relatórios
          </p>
        </div>
        <span className="text-[8px] font-mono text-amber/60 border border-amber/20 px-2 py-1 rounded-sm tracking-widest">
          EM DESENVOLVIMENTO
        </span>
      </div>

      {/* Roadmap */}
      <div className="border border-border bg-surface rounded-sm">
        <div className="px-4 py-3 border-b border-border">
          <span className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase">
            ROADMAP
          </span>
        </div>
        <div className="divide-y divide-border">
          {[
            "Schema de contas e transações (Supabase)",
            "Lançamento manual de receitas e despesas",
            "Import CSV de extratos bancários",
            "Dashboard com saldo e categorias",
            "Gráficos de fluxo de caixa (recharts)",
          ].map((item, i) => (
            <div key={i} className="px-4 py-2.5 flex items-center gap-3">
              <div className="w-1 h-1 rounded-full bg-on-surface/20 flex-none" />
              <span className="text-[11px] font-mono text-on-surface/40">{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
