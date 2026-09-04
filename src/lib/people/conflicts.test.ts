import { describe, it, expect } from "vitest"
import { checkGuestList } from "./conflicts"
import type { PersonConflictRow } from "@/lib/types"

const ANA = "11111111-1111-1111-1111-111111111111"
const BIA = "22222222-2222-2222-2222-222222222222"
const CAI = "33333333-3333-3333-3333-333333333333"

const people = [
  { id: ANA, name: "Ana" },
  { id: BIA, name: "Bia" },
  { id: CAI, name: "Caio" },
]

function conflito(over: Partial<PersonConflictRow>): PersonConflictRow {
  return {
    id: "c1",
    owner_id: "owner",
    subject_id: ANA,
    object_id: BIA,
    invite_policy: "nao_juntos",
    excluded_person_id: null,
    handling: [],
    veto_owner: "eu",
    reason: "briga de 2019",
    status: "ativo",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  }
}

function convites(pares: [string, string][]) {
  return pares.map(([person_id, status]) => ({ person_id, status }))
}

describe("checkGuestList", () => {
  it("retorna vazio quando não há convites", () => {
    expect(checkGuestList([], [conflito({})], people)).toEqual([])
  })

  it("bloqueia nao_juntos quando os dois estão na lista", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "confirmado"]]),
      [conflito({})],
      people,
    )
    expect(v).toHaveLength(1)
    expect(v[0].level).toBe("block")
    expect(v[0].message).toContain("Ana")
    expect(v[0].message).toContain("Bia")
  })

  it("não acusa nao_juntos quando só um está na lista", () => {
    const v = checkGuestList(convites([[ANA, "convidar"]]), [conflito({})], people)
    expect(v).toEqual([])
  })

  it("ignora conflito resolvido", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ status: "resolvido" })],
      people,
    )
    expect(v).toEqual([])
  })

  it("ignora cogitado, recusou e vetado", () => {
    for (const status of ["cogitado", "recusou", "vetado"]) {
      const v = checkGuestList(
        convites([[ANA, "convidar"], [BIA, status]]),
        [conflito({})],
        people,
      )
      expect(v).toEqual([])
    }
  })

  it("bloqueia excluir_um quando as duas pontas estão na lista", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ invite_policy: "excluir_um", excluded_person_id: ANA })],
      people,
    )
    expect(v).toHaveLength(1)
    expect(v[0].level).toBe("block")
    expect(v[0].excludedId).toBe(ANA)
    expect(v[0].message).toContain("Ana")
  })

  it("não acusa excluir_um quando a outra ponta está fora", () => {
    // Caso real: a pessoa PODE ir a eventos onde a outra não esteja.
    const v = checkGuestList(
      convites([[ANA, "convidar"]]),
      [conflito({ invite_policy: "excluir_um", excluded_person_id: ANA })],
      people,
    )
    expect(v).toEqual([])
  })

  it("bloqueia excluir_um quando excluded_person_id é o object", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ invite_policy: "excluir_um", excluded_person_id: BIA })],
      people,
    )
    expect(v).toHaveLength(1)
    expect(v[0].level).toBe("block")
    expect(v[0].excludedId).toBe(BIA)
    expect(v[0].message).toContain("Bia")
  })

  it("excluir_um com excluded_person_id nulo bloqueia sem apontar 'não definido'", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ invite_policy: "excluir_um", excluded_person_id: null })],
      people,
    )
    expect(v).toHaveLength(1)
    expect(v[0].level).toBe("block")
    expect(v[0].excludedId).toBeNull()
    expect(v[0].message).not.toContain("não definido")
    expect(v[0].message).toContain("Ana")
    expect(v[0].message).toContain("Bia")
  })

  it("excluir_um com excluded_person_id fora do par subject/object trata como indefinido", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ invite_policy: "excluir_um", excluded_person_id: CAI })],
      people,
    )
    expect(v).toHaveLength(1)
    expect(v[0].level).toBe("block")
    expect(v[0].excludedId).toBeNull()
    expect(v[0].message).not.toContain("não definido")
    expect(v[0].message).toContain("Ana")
    expect(v[0].message).toContain("Bia")
  })

  it("ok_com_ressalva sem handling não gera violação", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ invite_policy: "ok_com_ressalva", handling: [] })],
      people,
    )
    expect(v).toEqual([])
  })

  it("ok_com_ressalva com avisar_antes gera warn", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ invite_policy: "ok_com_ressalva", handling: ["avisar_antes"] })],
      people,
    )
    expect(v).toHaveLength(1)
    expect(v[0].level).toBe("warn")
  })

  it("ok_com_ressalva com os dois handling gera 2 violações", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [
        conflito({
          invite_policy: "ok_com_ressalva",
          handling: ["avisar_antes", "separar_no_evento"],
        }),
      ],
      people,
    )
    expect(v).toHaveLength(2)
    expect(v.map((x) => x.level).sort()).toEqual(["info", "warn"])
  })

  it("ordena block antes de warn antes de info", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"], [CAI, "convidar"]]),
      [
        conflito({
          id: "c-info",
          subject_id: BIA,
          object_id: CAI,
          invite_policy: "ok_com_ressalva",
          handling: ["separar_no_evento"],
        }),
        conflito({ id: "c-block", invite_policy: "nao_juntos" }),
      ],
      people,
    )
    expect(v.map((x) => x.level)).toEqual(["block", "info"])
  })

  it("não quebra com pessoa desconhecida na lista de nomes", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({})],
      [{ id: ANA, name: "Ana" }],
    )
    expect(v).toHaveLength(1)
    expect(v[0].message).toContain("desconhecid")
  })

  it("nunca inclui o reason na violação", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ reason: "segredo de família" })],
      people,
    )
    expect(JSON.stringify(v)).not.toContain("segredo")
  })
})
