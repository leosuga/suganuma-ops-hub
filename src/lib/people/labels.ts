import type {
  PersonSide,
  PersonCircle,
  RelationKind,
  InvitePolicy,
  VetoOwner,
  ConflictHandling,
  InviteStatus,
} from "@/lib/types"
import type { ViolationLevel } from "@/lib/people/conflicts"

/**
 * Único lugar do módulo que traduz enums do banco para texto de UI.
 * Isso é exibição — não interpretação de política (essa continua exclusiva
 * de `checkGuestList` em conflicts.ts, ver comentário lá).
 *
 * Textos preservados como estavam nas cópias locais que existiam antes desta
 * consolidação (PersonRow, RelationFormDialog, [id]/page.tsx, ViolationPanel,
 * InviteRow) — só `HANDLING_LABEL` é novo, para os dois valores que hoje
 * chegam crus na ficha da pessoa.
 */

export const SIDE_LABEL: Record<PersonSide, string> = {
  leo: "MEU",
  parceira: "DELA",
  comum: "COMUM",
  outro: "—",
}

export const CIRCLE_LABEL: Record<PersonCircle, string> = {
  familia_nuclear: "Família nuclear",
  familia_extensa: "Família extensa",
  amigos: "Amigos",
  trabalho: "Trabalho",
  vizinhos: "Vizinhos",
  outro: "Outro",
}

export const KIND_LABEL: Record<RelationKind, string> = {
  conjuge: "é cônjuge de",
  filho_de: "é filho(a) de",
  pai_de: "é pai/mãe de",
  irmao_de: "é irmão(ã) de",
  amigo_de: "é amigo(a) de",
  colega_de: "é colega de",
  ex_de: "é ex de",
}

export const POLICY_LABEL: Record<InvitePolicy, string> = {
  excluir_um: "Excluir um",
  nao_juntos: "Não juntos",
  ok_com_ressalva: "Com ressalva",
}

export const VETO_LABEL: Record<VetoOwner, string> = {
  eu: "decisão minha",
  parceira: "decisão dela",
  ambos: "decisão nossa",
}

/** Novo — antes renderizado cru (`c.handling.join(", ")`) na ficha da pessoa. */
export const HANDLING_LABEL: Record<ConflictHandling, string> = {
  avisar_antes: "avisar antes",
  separar_no_evento: "separar no evento",
}

export const INVITE_STATUS_ORDER: InviteStatus[] = [
  "cogitado",
  "convidar",
  "convidado",
  "confirmado",
  "recusou",
  "vetado",
]

export const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  cogitado: "?",
  convidar: "CONVIDAR",
  convidado: "CONVIDADO",
  confirmado: "CONFIRMOU",
  recusou: "RECUSOU",
  vetado: "VETADO",
}

export const VIOLATION_LEVEL_LABEL: Record<ViolationLevel, string> = {
  block: "BLOQUEIO",
  warn: "AVISAR",
  info: "LOGÍSTICA",
}
