// O restore insere na ordem de IMPORT_ORDER; uma tabela filha antes do pai
// falharia na FK e perderia linhas em silêncio (o erro é só logado por chunk).
import { describe, it, expect, vi } from "vitest"

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
vi.mock("@/lib/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))

import { IMPORT_ORDER, FK_COLUMNS_TO_STRIP } from "@/lib/export-import"

describe("IMPORT_ORDER", () => {
  it("importa child antes de baby_log", () => {
    const order = IMPORT_ORDER as readonly string[]
    expect(order).toContain("child")
    expect(order).toContain("baby_log")
    expect(order.indexOf("child")).toBeLessThan(order.indexOf("baby_log"))
  })

  it("importa project e pregnancy antes de child (FKs que ele aponta)", () => {
    const order = IMPORT_ORDER as readonly string[]
    expect(order.indexOf("project")).toBeLessThan(order.indexOf("child"))
    expect(order.indexOf("pregnancy")).toBeLessThan(order.indexOf("child"))
  })

  it("zera as FKs externas de child, mas mantém child_id de baby_log", () => {
    expect(FK_COLUMNS_TO_STRIP.child).toEqual(["project_id", "pregnancy_id"])
    expect(FK_COLUMNS_TO_STRIP.baby_log ?? []).not.toContain("child_id")
  })
})
