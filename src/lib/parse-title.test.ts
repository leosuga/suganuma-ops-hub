import { describe, it, expect } from "vitest"
import { parseTitle } from "./parse-title"

describe("parseTitle", () => {
  it("returns plain title when no special tokens", () => {
    const result = parseTitle("Comprar pão", [])
    expect(result.title).toBe("Comprar pão")
    expect(result.category).toBeUndefined()
    expect(result.priority).toBeUndefined()
  })

  it("extracts category token", () => {
    const result = parseTitle("Pagar conta #finance", [])
    expect(result.title).toBe("Pagar conta")
    expect(result.category).toBe("finance")
  })

  it("extracts priority token", () => {
    const result = parseTitle("Revisar relatório !urgent", [])
    expect(result.title).toBe("Revisar relatório")
    expect(result.priority).toBe("urgent")
  })

  it("extracts tags", () => {
    const result = parseTitle("Task #cliente #bug", [])
    expect(result.title).toBe("Task")
    expect(result.tags).toEqual(["cliente", "bug"])
  })

  it("extracts delegated user", () => {
    const result = parseTitle("Revisar @João", [])
    expect(result.title).toBe("Revisar")
    expect(result.delegated_to).toBe("João")
  })

  it("extracts important flag", () => {
    const result = parseTitle("Fazer algo +importante", [])
    expect(result.title).toBe("Fazer algo")
    expect(result.important).toBe(true)
  })

  it("extracts recurrence token", () => {
    const result = parseTitle("Limpar *diario", [])
    expect(result.title).toBe("Limpar")
    expect(result.recurrence).toBe("daily")
  })

  it("matches project by longest name", () => {
    const projects = [
      { id: "1", name: "Casa" },
      { id: "2", name: "Casa Nova" },
    ]
    const result = parseTitle(">Casa Nova task", projects)
    expect(result.title).toBe("task")
    expect(result.project_id).toBe("2")
  })

  it("parses due date from ^today", () => {
    const result = parseTitle("Entregar ^today", [])
    expect(result.title).toBe("Entregar")
    expect(result.due_at).toBeDefined()
  })

  it("parses due date from ^tomorrow", () => {
    const result = parseTitle("Entregar ^tomorrow", [])
    expect(result.title).toBe("Entregar")
    expect(result.due_at).toBeDefined()
  })

  it("parses due date from YYYY-MM-DD", () => {
    const result = parseTitle("Entregar ^2026-12-25", [])
    expect(result.title).toBe("Entregar")
    expect(result.due_at).toBeDefined()
    expect(result.due_at).toMatch(/^2026-12-2[56]T\d{2}:59:00\.000Z$/)
  })

  it("handles combined tokens", () => {
    const result = parseTitle(
      "Revisar #finance !high +importante ^tomorrow",
      []
    )
    expect(result.title).toBe("Revisar")
    expect(result.category).toBe("finance")
    expect(result.priority).toBe("high")
    expect(result.important).toBe(true)
    expect(result.due_at).toBeDefined()
  })
})
