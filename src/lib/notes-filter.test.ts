// Testes do filtro de Notas. O caso do prefixo "#" é uma REGRESSÃO: o
// matcher antigo procurava "#/" e o filtro "#geral" não encontrava nada.
import { describe, it, expect } from "vitest"
import { matchesNoteFilters } from "@/lib/notes-filter"

const note = {
  title: "Postpartum — checklist da 1ª semana",
  content: "Pediatra, vitamina D, licença-maternidade",
  tags: ["ctx/saude", "bebe", "geral", "projeto/reforma"],
  para: "areas",
}

describe("matchesNoteFilters", () => {
  it("sem filtro: passa", () => {
    expect(matchesNoteFilters(note, {})).toBe(true)
  })

  it("tag: exige a tag exata", () => {
    expect(matchesNoteFilters(note, { tag: "bebe" })).toBe(true)
    expect(matchesNoteFilters(note, { tag: "saude" })).toBe(false)
  })

  it("prefixo real: casa as tags do grupo", () => {
    // O prefixo é a parte ANTES da barra ("ctx", "projeto")
    expect(matchesNoteFilters(note, { prefix: "projeto" })).toBe(true)
    expect(matchesNoteFilters(note, { prefix: "ctx" })).toBe(true)
    expect(matchesNoteFilters(note, { prefix: "financeiro" })).toBe(false)
  })

  it("prefixo tolera barra final (URL escrita à mão)", () => {
    expect(matchesNoteFilters(note, { prefix: "ctx/" })).toBe(true)
  })

  it("prefixo '#': casa as tags SEM barra (regressão do '#/')", () => {
    expect(matchesNoteFilters(note, { prefix: "#" })).toBe(true)
    // "geral" não tem barra → entra no grupo "#"
    const soComBarra = { ...note, tags: ["ctx/saude"] }
    expect(matchesNoteFilters(soComBarra, { prefix: "#" })).toBe(false)
  })

  it("contexto: exige a tag ctx/<contexto>", () => {
    expect(matchesNoteFilters(note, { ctx: "saude" })).toBe(true)
    expect(matchesNoteFilters(note, { ctx: "casa" })).toBe(false)
  })

  it("para: exige a área", () => {
    expect(matchesNoteFilters(note, { para: "areas" })).toBe(true)
    expect(matchesNoteFilters(note, { para: "resources" })).toBe(false)
  })

  it("busca: casa título, conteúdo e tags", () => {
    expect(matchesNoteFilters(note, { search: "PEDIATRA" })).toBe(true)
    expect(matchesNoteFilters(note, { search: "checklist" })).toBe(true)
    expect(matchesNoteFilters(note, { search: "bebe" })).toBe(true)
    expect(matchesNoteFilters(note, { search: "inexistente" })).toBe(false)
  })

  it("filtros combinam (e)", () => {
    expect(matchesNoteFilters(note, { prefix: "ctx", search: "pediatra" })).toBe(true)
    // a busca casa TAGS também — "reforma" casa "projeto/reforma"
    expect(matchesNoteFilters(note, { prefix: "ctx", search: "reforma" })).toBe(true)
    expect(matchesNoteFilters(note, { prefix: "ctx", search: "inexistente" })).toBe(false)
  })

  it("nota sem tags não passa nos filtros de tag/prefixo/ctx", () => {
    const semTags = { title: "x", content: null, tags: null, para: null }
    expect(matchesNoteFilters(semTags, { tag: "bebe" })).toBe(false)
    expect(matchesNoteFilters(semTags, { prefix: "#" })).toBe(false)
    expect(matchesNoteFilters(semTags, { ctx: "saude" })).toBe(false)
  })
})
