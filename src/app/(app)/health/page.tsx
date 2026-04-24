export default function HealthPage() {
  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[11px] font-mono font-semibold tracking-[0.3em] text-teal uppercase">
          HEALTH HUB
        </h1>
        <p className="text-[10px] font-mono text-on-surface/30 mt-0.5">
          Saúde, gravidez e protocolos familiares
        </p>
      </div>

      {/* Coming soon card */}
      <div className="border border-border bg-surface rounded-sm p-8 flex flex-col items-center gap-4 text-center">
        <div className="w-3 h-3 rounded-full bg-[#A8D8B0]/30 border border-[#A8D8B0]/40" />
        <div>
          <p className="text-[12px] font-mono text-on-surface/60">
            Health Hub — Fase 3
          </p>
          <p className="text-[10px] font-mono text-on-surface/30 mt-1">
            Gestão completa de saúde e bem-estar familiar
          </p>
        </div>
        <span className="text-[8px] font-mono text-[#A8D8B0]/60 border border-[#A8D8B0]/20 px-2 py-1 rounded-sm tracking-widest">
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
            "Gravidez tracker com semanas e marcos",
            "Biometria (peso, pressão, glicemia)",
            "Protocolos diários (medicamentos, suplementos)",
            "Agendamentos médicos e consultas",
            "Histórico e relatórios de saúde",
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
