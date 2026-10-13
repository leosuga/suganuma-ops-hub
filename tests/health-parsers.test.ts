// O BiometricLog e o Zod gravam a glicemia como `mg_dl`; o parser lia `mgdl`
// e por isso sempre devolvia null.
import { describe, it, expect } from "vitest"
import { parseGlucoseValue } from "@/lib/types/health"

describe("parseGlucoseValue", () => {
  it("lê o formato gravado pelo app (mg_dl)", () => {
    expect(parseGlucoseValue({ mg_dl: 95, fasting: true })).toEqual({ mgdl: 95, fasting: true })
  })

  it("continua aceitando o formato legado (mgdl)", () => {
    expect(parseGlucoseValue({ mgdl: 110 })).toEqual({ mgdl: 110, fasting: undefined })
  })

  it("devolve null quando não há valor numérico", () => {
    expect(parseGlucoseValue({ mg_dl: "95" })).toBeNull()
    expect(parseGlucoseValue(null)).toBeNull()
  })
})
