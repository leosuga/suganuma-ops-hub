"use client"

// Orientação geral de sinais de alerta no pós-parto. NÃO substitui o pediatra
// nem o obstetra — o painel diz isso e é conteúdo estático, fácil de revisar.
const BABY_SIGNS = [
  "Febre: temperatura axilar de 37,8 °C ou mais",
  "Dificuldade para respirar, gemido, lábios ou pele arroxeados",
  "Moleza, não acorda para mamar ou recusa várias mamadas seguidas",
  "Pele amarelada (icterícia) que aparece nas primeiras 24 h ou desce para barriga e pernas",
  "Vômitos em jato, verdes ou com sangue; fezes com sangue ou brancas/acinzentadas",
  "Poucas fraldas molhadas (menos de 6 por dia após o 5º dia de vida)",
  "Coto do umbigo com pus, mau cheiro ou vermelhidão ao redor",
  "Convulsão ou choro inconsolável por muitas horas",
]

const MOTHER_SIGNS = [
  "Sangramento intenso (encher um absorvente em 1 hora) ou coágulos grandes",
  "Febre de 38 °C ou mais, ou calafrios",
  "Dor, vermelhidão, pus ou abertura no corte da cesárea ou nos pontos",
  "Dor de cabeça forte, visão turva ou inchaço repentino (risco de pré-eclâmpsia pós-parto)",
  "Dor ou inchaço em uma perna, falta de ar ou dor no peito",
  "Mama dura, vermelha e dolorida com febre (possível mastite)",
  "Tristeza profunda, ansiedade intensa ou pensamentos de se machucar: procure ajuda hoje (CVV: 188)",
]

function Group({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[9px] font-mono font-semibold tracking-widest text-on-surface/40 uppercase mb-1.5">{title}</p>
      <ul className="space-y-1">
        {items.map((s) => (
          <li key={s} className="text-[11px] font-mono text-on-surface/70 leading-snug">· {s}</li>
        ))}
      </ul>
    </div>
  )
}

export function WarningSignsPanel() {
  return (
    <details className="border border-border bg-surface rounded-sm">
      <summary className="min-h-[44px] px-4 flex items-center cursor-pointer text-[9px] font-mono font-semibold tracking-widest text-amber uppercase">
        QUANDO PROCURAR AJUDA
      </summary>
      <div className="px-4 pb-4 space-y-4">
        <Group title="Bebê" items={BABY_SIGNS} />
        <Group title="Mãe" items={MOTHER_SIGNS} />
        <p className="text-[10px] font-mono text-on-surface/40 leading-snug">
          Orientação geral, não substitui o pediatra nem o obstetra. Em dúvida, ligue para o
          médico ou vá ao pronto-socorro. Emergência: SAMU 192.
        </p>
      </div>
    </details>
  )
}
