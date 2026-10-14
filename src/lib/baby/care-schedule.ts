import { addDaysStr, addMonthsStr } from "./dates"

// Cronograma de cuidados do bebê, calculado a partir da data de nascimento.
// É um PONTO DE PARTIDA, não prescrição: os calendários de vacina (SBIm/SBP/PNI)
// mudam e divergem entre si. Cada item vira uma task comum, que o usuário revisa
// e edita; as notas lembram de confirmar com o pediatra.

export const CARE_GROUPS = ["triagem", "consulta", "vacina", "documento", "mae", "compras"] as const
export type CareGroup = (typeof CARE_GROUPS)[number]

export const CARE_GROUP_LABEL: Record<CareGroup, string> = {
  triagem: "TRIAGENS",
  consulta: "CONSULTAS",
  vacina: "VACINAS",
  documento: "DOCUMENTOS",
  mae: "CUIDADOS DA MÃE",
  compras: "COMPRAS",
}

export interface CareItem {
  key: string
  title: string
  group: CareGroup
  tags: string[]
  category: "finance" | "logistics" | "personal" | "health"
  priority: "low" | "med" | "high" | "urgent"
  offset: { days: number } | { months: number }
  notes?: string
  recurrence?: "daily" | "weekly" | "monthly"
}

export interface ScheduledCareItem extends CareItem {
  dueDate: string
  isPast: boolean
}

type Overrides = Partial<Pick<CareItem, "priority" | "notes" | "recurrence" | "category">>

function item(
  group: CareGroup,
  key: string,
  title: string,
  offset: CareItem["offset"],
  extra: Overrides & { tags?: string[] } = {},
): CareItem {
  const { tags = [], ...rest } = extra
  const defaults: Record<CareGroup, Pick<CareItem, "category" | "priority">> = {
    triagem: { category: "health", priority: "med" },
    consulta: { category: "health", priority: "high" },
    vacina: { category: "health", priority: "high" },
    documento: { category: "logistics", priority: "med" },
    mae: { category: "health", priority: "med" },
    compras: { category: "logistics", priority: "med" },
  }
  return {
    key,
    title,
    group,
    tags: ["bebe", group, ...tags],
    offset,
    ...defaults[group],
    ...rest,
  }
}

const VAC_NOTE = "Esquema do calendário SBIm 2026-27. Confirme doses e idades com o pediatra/clínica."
const CONSULT_NOTE =
  "Levar a caderneta de vacinação; medir peso, comprimento e perímetro cefálico; anotar dúvidas antes."

const d = (days: number) => ({ days })
const m = (months: number) => ({ months })

export const CARE_ITEMS: CareItem[] = [
  // ------------------------------------------------------------ triagens
  item("triagem", "triagem-coracaozinho", "Teste do coraçãozinho (oximetria de pulso)", d(1), {
    notes: "Feito na maternidade entre 24 h e 48 h de vida. Conferir o registro na caderneta.",
  }),
  item("triagem", "triagem-olhinho", "Teste do olhinho (reflexo vermelho)", d(1), {
    notes: "Feito na maternidade antes da alta ou nos primeiros 7 dias.",
  }),
  item("triagem", "triagem-orelhinha", "Teste da orelhinha (triagem auditiva)", d(2), {
    notes: "Idealmente antes da alta; se não foi feito, agendar no 1º mês.",
  }),
  item("triagem", "triagem-linguinha", "Teste da linguinha (frênulo lingual)", d(2), {
    notes: "Avalia anquiloglossia; importante para a pega na amamentação.",
  }),
  item("triagem", "triagem-pezinho", "Teste do pezinho (3º ao 5º dia de vida)", d(4), {
    priority: "urgent",
    notes: "Coleta entre o 3º e o 5º dia de vida. Pergunte onde e quando sai o resultado.",
  }),
  item("triagem", "triagem-pezinho-resultado", "Buscar o resultado do teste do pezinho", d(20), {
    priority: "high",
    notes: "Se faltou algum exame ou veio alterado, refazer o quanto antes.",
  }),

  // ----------------------------------------------------------- consultas
  item("consulta", "consulta-1sem", "Pediatra: 1ª semana (peso, icterícia, amamentação)", d(5), {
    priority: "urgent",
    notes: CONSULT_NOTE,
  }),
  item("consulta", "consulta-1m", "Pediatra: 1 mês", m(1), { notes: CONSULT_NOTE }),
  item("consulta", "consulta-2m", "Pediatra: 2 meses", m(2), { notes: CONSULT_NOTE }),
  item("consulta", "consulta-3m", "Pediatra: 3 meses", m(3), { notes: CONSULT_NOTE }),
  item("consulta", "consulta-4m", "Pediatra: 4 meses", m(4), { notes: CONSULT_NOTE }),
  item("consulta", "consulta-5m", "Pediatra: 5 meses", m(5), { notes: CONSULT_NOTE }),
  item("consulta", "consulta-6m", "Pediatra: 6 meses (introdução alimentar)", m(6), { notes: CONSULT_NOTE }),
  item("consulta", "consulta-9m", "Pediatra: 9 meses", m(9), { notes: CONSULT_NOTE }),
  item("consulta", "consulta-12m", "Pediatra: 12 meses", m(12), { notes: CONSULT_NOTE }),

  // -------------------------------------------------------------- vacinas
  item("vacina", "vacina-nascer", "Vacinas ao nascer: BCG e hepatite B", d(0), {
    notes: "Aplicadas na maternidade. Conferir na caderneta se as duas constam.",
  }),
  item("vacina", "vacina-vsr", "Avaliar proteção contra VSR (nirsevimabe/clesrovimabe)", d(7), {
    notes:
      "A SBIm recomenda para menores de 12 meses, em qualquer época do ano. Dose pelo peso (50 mg se < 5 kg; 100 mg se ≥ 5 kg). No SUS, em 2026, só para prematuros e crianças com comorbidades. Decidir com o pediatra.",
  }),
  item("vacina", "vacina-2m", "Vacinas de 2 meses: hexavalente, pneumocócica e rotavírus (1ª dose)", m(2), {
    notes: `${VAC_NOTE} A 1ª dose de rotavírus tem limite de idade: não deixe passar da janela.`,
  }),
  item("vacina", "vacina-3m", "Vacinas de 3 meses: meningocócica ACWY e meningocócica B (1ª dose)", m(3), {
    notes: VAC_NOTE,
  }),
  item("vacina", "vacina-4m", "Vacinas de 4 meses: hexavalente, pneumocócica e rotavírus (2ª dose)", m(4), {
    notes: VAC_NOTE,
  }),
  item("vacina", "vacina-5m", "Vacinas de 5 meses: meningocócica ACWY e meningocócica B (2ª dose)", m(5), {
    notes: VAC_NOTE,
  }),
  item("vacina", "vacina-6m", "Vacinas de 6 meses: hexavalente (3ª), pneumocócica (conforme esquema) e influenza (1ª)", m(6), {
    notes: `${VAC_NOTE} Perguntar também sobre a covid-19 conforme o calendário vigente.`,
  }),
  item("vacina", "vacina-7m", "Vacina de 7 meses: influenza (2ª dose, 30 dias após a 1ª)", m(7), { notes: VAC_NOTE }),
  item("vacina", "vacina-9m", "Vacina de 9 meses: febre amarela", m(9), { notes: VAC_NOTE }),
  item(
    "vacina",
    "vacina-12m",
    "Vacinas de 12 meses: tríplice viral, varicela, hepatite A e reforços (pneumocócica, meningocócicas)",
    m(12),
    { notes: VAC_NOTE },
  ),
  item("vacina", "vacina-15m", "Vacinas de 15 meses: reforço DTPa/hexa e tríplice viral/tetraviral (2ª dose)", m(15), {
    notes: VAC_NOTE,
  }),
  item("vacina", "vacina-18m", "Vacina de 18 meses: hepatite A (2ª dose)", m(18), { notes: VAC_NOTE }),

  // ----------------------------------------------------------- documentos
  item("documento", "doc-licenca-paternidade", "Pedir a licença-paternidade ao RH", d(1), {
    priority: "high",
    notes: "Em 2026 ainda são 5 dias corridos; a Lei 15.371/2026 amplia o prazo a partir de 2027.",
  }),
  item("documento", "doc-licenca-maternidade", "Conferir a licença-maternidade da mãe e a data de retorno", d(7), {
    notes: "Confirmar com o RH dela o início, o fim e se a empresa estende a licença (Empresa Cidadã).",
  }),
  item("documento", "doc-certidao", "Registrar a certidão de nascimento no cartório (e emitir o CPF)", d(10), {
    priority: "urgent",
    notes:
      "Prazo legal de 15 dias do nascimento (Lei 6.015/73, art. 50). Levar a declaração de nascido vivo e os documentos dos pais. Em muitos cartórios o CPF sai junto.",
  }),
  item("documento", "doc-plano-saude", "Incluir a bebê no plano de saúde (sem carência até 30 dias)", d(25), {
    priority: "urgent",
    notes:
      "Prazo de 30 dias do nascimento para a inclusão sem carência (Lei 9.656/98, art. 12, III, b). Precisa da certidão: não deixe para a última semana.",
  }),
  item("documento", "doc-cartao-sus", "Emitir o Cartão SUS da bebê", d(30), {
    notes: "Na UBS mais próxima, com a certidão e documentos dos pais.",
  }),
  item("documento", "doc-dependente-rh", "Incluir a bebê como dependente no RH (benefícios, auxílio-creche)", d(30), {
    notes: "Plano, seguro de vida e auxílio-creche, se houver, costumam exigir a certidão.",
  }),
  item("documento", "doc-ir", "Incluir a bebê como dependente no IR e guardar as despesas médicas", m(4), {
    priority: "low",
    category: "finance",
    notes: "Declaração de 2027 (ano-base 2026). Guardar recibos de consultas e exames.",
  }),

  // ----------------------------------------------------------------- mãe
  item("mae", "mae-revisao-precoce", "Revisão pós-parto precoce da mãe (obstetra)", d(7), {
    priority: "high",
    notes: "Avaliar cicatrização, sangramento, pressão e amamentação. Levar as dúvidas.",
  }),
  item("mae", "mae-emocional", "Check-in de saúde emocional da mãe", d(14), {
    notes:
      "O baby blues costuma passar em cerca de 2 semanas. Se a tristeza, a ansiedade ou o choro persistirem, procurar o obstetra ou um psicólogo. Em crise, CVV: 188.",
  }),
  item("mae", "mae-revisao-6sem", "Revisão pós-parto de ~6 semanas (contracepção, exames, atividade física)", d(42), {
    priority: "high",
  }),
  item("mae", "mae-retorno-trabalho", "Planejar o retorno da mãe ao trabalho (creche/babá, estoque de leite)", d(90), {
    priority: "low",
    category: "personal",
  }),

  // -------------------------------------------------------------- compras
  item("compras", "compra-fraldas", "Repor fraldas do tamanho atual", d(7), {
    recurrence: "weekly",
    notes: "Conferir o consumo da semana e o peso da bebê para saber a hora de trocar de tamanho.",
  }),
  item("compras", "compra-higiene", "Comprar pomada de assadura, lenços e algodão", d(7)),
  item("compras", "compra-alcool-coto", "Álcool 70% para o coto umbilical", d(7), {
    notes: "Limpar a cada troca de fralda até cair, conforme orientação do pediatra.",
  }),
  item("compras", "compra-termometro", "Termômetro digital", d(7)),
  item("compras", "compra-soro-aspirador", "Soro fisiológico e aspirador nasal", d(7)),
  item("compras", "compra-vit-d", "Vitamina D em gotas (pedir a receita ao pediatra)", d(7), {
    priority: "high",
    notes: "A SBP recomenda 400 UI/dia no 1º ano, desde a 1ª semana de vida para quem mama no peito.",
  }),
  item("compras", "compra-mae", "Itens da mãe: absorvente pós-parto, protetor de seio, lanolina, sutiã de amamentação", d(7)),
  item("compras", "compra-fraldas-m", "Comprar fraldas tamanho M (conferir o peso da bebê)", d(50)),
  item("compras", "compra-roupas-3-6m", "Roupas de 3 a 6 meses", d(75), { priority: "low" }),
]

/** Meio-dia de São Paulo (UTC-3), em ISO UTC: não cai no dia errado em nenhum fuso. */
export function dueAtFor(dateStr: string): string {
  return new Date(`${dateStr}T12:00:00-03:00`).toISOString()
}

/** Datas do cronograma a partir do nascimento; `isPast` = venceu antes de `todayStr`. */
export function buildCareSchedule(birthDate: string, todayStr: string): ScheduledCareItem[] {
  return CARE_ITEMS.map((it) => {
    const dueDate =
      "days" in it.offset ? addDaysStr(birthDate, it.offset.days) : addMonthsStr(birthDate, it.offset.months)
    return { ...it, dueDate, isPast: dueDate < todayStr }
  }).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export interface TaskDraft {
  title: string
  notes?: string
  category: CareItem["category"]
  priority: CareItem["priority"]
  status: "todo" | "done"
  due_at: string
  completed_at?: string
  project_id: string
  important: false
  tags: string[]
  recurrence?: "daily" | "weekly" | "monthly"
}

/** Linha de task para um item do cronograma; itens já feitos entram concluídos na própria data. */
export function toTaskDraft(
  it: ScheduledCareItem,
  opts: { done: boolean; projectId: string },
): TaskDraft {
  const due = dueAtFor(it.dueDate)
  return {
    title: it.title,
    notes: it.notes,
    category: it.category,
    priority: it.priority,
    status: opts.done ? "done" : "todo",
    due_at: due,
    ...(opts.done ? { completed_at: due } : {}),
    project_id: opts.projectId,
    important: false,
    tags: it.tags,
    ...(it.recurrence ? { recurrence: it.recurrence } : {}),
  }
}
