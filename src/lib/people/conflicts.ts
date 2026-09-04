import type { PersonConflictRow, VetoOwner } from "@/lib/types"

export type ViolationLevel = "block" | "warn" | "info"

export interface Violation {
  level: ViolationLevel
  conflictId: string
  subjectId: string
  objectId: string
  /** Preenchido só em excluir_um: quem a decisão manda deixar de fora. */
  excludedId: string | null
  vetoOwner: VetoOwner
  message: string
}

/**
 * Status que contam como "está na lista". `cogitado` ainda não é convite,
 * `recusou` e `vetado` já saíram — nenhum dos três gera conflito.
 */
export const ON_LIST_STATUSES: ReadonlySet<string> = new Set([
  "convidar",
  "convidado",
  "confirmado",
])

const LEVEL_ORDER: Record<ViolationLevel, number> = {
  block: 0,
  warn: 1,
  info: 2,
}

/**
 * Único ponto do app que interpreta `invite_policy` e `handling`.
 * Componentes recebem Violation[] pronto e nunca fazem switch sobre a
 * política — é isso que mantém barata a extração futura dessa política
 * para outro domínio (spec §2.5).
 *
 * O campo `reason` do conflito NUNCA entra na Violation: é o dado mais
 * sensível do módulo e só aparece na ficha, sob interação explícita.
 */
export function checkGuestList(
  invites: { person_id: string; status: string }[],
  conflicts: PersonConflictRow[],
  people: { id: string; name: string }[],
): Violation[] {
  const onList = new Set(
    invites.filter((i) => ON_LIST_STATUSES.has(i.status)).map((i) => i.person_id),
  )
  const nameById = new Map(people.map((p) => [p.id, p.name]))
  const nameOf = (id: string) => nameById.get(id) ?? "(pessoa desconhecida)"

  const violations: Violation[] = []

  for (const c of conflicts) {
    if (c.status !== "ativo") continue

    const bothOnList = onList.has(c.subject_id) && onList.has(c.object_id)
    if (!bothOnList) continue

    const subject = nameOf(c.subject_id)
    const object = nameOf(c.object_id)
    const base = {
      conflictId: c.id,
      subjectId: c.subject_id,
      objectId: c.object_id,
      vetoOwner: c.veto_owner,
    }

    if (c.invite_policy === "excluir_um") {
      const excludedId = c.excluded_person_id
      const isKnownSide = excludedId === c.subject_id || excludedId === c.object_id

      if (!isKnownSide) {
        // excluded_person_id ausente (null) ou apontando para alguém fora do
        // par subject/object — o banco impede isso hoje, mas a função é pura
        // e não pode depender silenciosamente dessa invariante. O conflito é
        // real (block), só não sabemos qual dos dois excluir.
        violations.push({
          ...base,
          level: "block",
          excludedId: null,
          message: `${subject} e ${object}: o conflito exige excluir um dos dois, mas não está registrado qual.`,
        })
        continue
      }

      const excluded = nameOf(excludedId)
      violations.push({
        ...base,
        level: "block",
        excludedId,
        message: `${excluded} não deve ser convidado quando ${
          excludedId === c.subject_id ? object : subject
        } está na lista.`,
      })
      continue
    }

    if (c.invite_policy === "nao_juntos") {
      violations.push({
        ...base,
        level: "block",
        excludedId: null,
        message: `${subject} e ${object} não podem estar na mesma lista — escolha um.`,
      })
      continue
    }

    // ok_com_ressalva: sem handling, não há nada a fazer — não é violação,
    // é um conflito registrado que não exige ação.
    if (c.handling.includes("avisar_antes")) {
      violations.push({
        ...base,
        level: "warn",
        excludedId: null,
        message: `Avisar antes: ${subject} e ${object} estarão no mesmo evento.`,
      })
    }
    if (c.handling.includes("separar_no_evento")) {
      violations.push({
        ...base,
        level: "info",
        excludedId: null,
        message: `Manter ${subject} e ${object} afastados durante o evento.`,
      })
    }
  }

  return violations.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])
}
