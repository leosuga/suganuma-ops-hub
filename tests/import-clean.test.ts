import { describe, it, expect } from "vitest"
import { cleanRowsForImport, PRESERVE_ID_TABLES } from "@/lib/import-clean"

const OWNER = "owner-novo"

describe("cleanRowsForImport", () => {
  it("stripa id e timestamps nas tabelas normais", () => {
    const out = cleanRowsForImport(
      "task",
      [{ id: "t1", owner_id: "antigo", created_at: "x", updated_at: "y", title: "Oi" }],
      OWNER,
      [],
    )
    expect(out[0]).not.toHaveProperty("id")
    expect(out[0]).not.toHaveProperty("created_at")
    expect(out[0].owner_id).toBe(OWNER)
    expect(out[0].title).toBe("Oi")
  })

  it("zera as FKs listadas nas tabelas normais", () => {
    const out = cleanRowsForImport(
      "task",
      [{ id: "t1", project_id: "p1", title: "Oi" }],
      OWNER,
      ["project_id"],
    )
    expect(out[0].project_id).toBeNull()
  })

  it("PRESERVA o id nas tabelas do módulo people", () => {
    const out = cleanRowsForImport(
      "person",
      [{ id: "p1", owner_id: "antigo", created_at: "x", name: "Ana" }],
      OWNER,
      [],
    )
    expect(out[0].id).toBe("p1")
    expect(out[0].owner_id).toBe(OWNER)
    expect(out[0]).not.toHaveProperty("created_at")
  })

  it("PRESERVA as FKs intra-módulo do conflito", () => {
    // Este é o teste que impede a regressão: se subject_id/object_id forem
    // zerados, um restore devolve conflitos órfãos e o grafo morre.
    const out = cleanRowsForImport(
      "person_conflict",
      [
        {
          id: "c1",
          subject_id: "p1",
          object_id: "p2",
          excluded_person_id: "p1",
          invite_policy: "excluir_um",
        },
      ],
      OWNER,
      [],
    )
    expect(out[0].subject_id).toBe("p1")
    expect(out[0].object_id).toBe("p2")
    expect(out[0].excluded_person_id).toBe("p1")
  })

  it("as cinco tabelas do módulo estão em PRESERVE_ID_TABLES", () => {
    for (const t of [
      "person",
      "person_relation",
      "person_conflict",
      "guest_event",
      "guest_invite",
    ]) {
      expect(PRESERVE_ID_TABLES.has(t)).toBe(true)
    }
  })

  it("tabelas antigas NÃO estão em PRESERVE_ID_TABLES", () => {
    expect(PRESERVE_ID_TABLES.has("task")).toBe(false)
    expect(PRESERVE_ID_TABLES.has("note")).toBe(false)
  })

  it("linha sem id em tabela preservada não inventa id", () => {
    const out = cleanRowsForImport("person", [{ name: "Ana" }], OWNER, [])
    expect(out[0]).not.toHaveProperty("id")
  })
})
