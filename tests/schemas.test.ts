import { describe, it, expect } from "vitest"
import { taskSchema } from "@/lib/schemas/task"
import { transactionSchema, accountSchema } from "@/lib/schemas/finance"
import { healthLogSchema, pregnancySchema, appointmentSchema, protocolSchema, protocolEntrySchema } from "@/lib/schemas/health"
import { mealSchema, mealPlanSchema } from "@/lib/schemas/meal"
import { noteSchema } from "@/lib/schemas/note"
import { habitTrackSchema, habitEntrySchema } from "@/lib/schemas/habit"
import {
  personSchema,
  personConflictSchema,
  guestInviteSchema,
} from "@/lib/schemas/people"


describe("taskSchema", () => {
  it("parses a valid task with defaults", () => {
    const r = taskSchema.safeParse({ title: "Buy groceries", category: "personal", priority: "med" })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.title).toBe("Buy groceries")
      expect(r.data.status).toBe("todo")
    }
  })

  it("applies defaults for missing fields", () => {
    const r = taskSchema.safeParse({ title: "X" })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.status).toBe("todo")
      expect(r.data.category).toBe("personal")
      expect(r.data.priority).toBe("med")
    }
  })

  it("rejects empty title", () => {
    expect(taskSchema.safeParse({ title: "" }).success).toBe(false)
  })

  it("accepts all valid statuses", () => {
    for (const s of ["todo", "doing", "done", "archived"] as const) {
      expect(taskSchema.safeParse({ title: "T", status: s }).success).toBe(true)
    }
  })

  it("rejects invalid status", () => {
    expect(taskSchema.safeParse({ title: "T", status: "invalid" }).success).toBe(false)
  })

  it("accepts all valid categories", () => {
    for (const c of ["finance", "logistics", "personal", "health"] as const) {
      expect(taskSchema.safeParse({ title: "T", category: c }).success).toBe(true)
    }
  })

  it("accepts optional due_at ISO datetime", () => {
    expect(taskSchema.safeParse({ title: "T", due_at: "2026-12-25T00:00:00.000Z" }).success).toBe(true)
  })

  it("rejects invalid priority", () => {
    expect(taskSchema.safeParse({ title: "T", priority: "extreme" }).success).toBe(false)
  })
})

describe("transactionSchema", () => {
  it("parses a valid expense", () => {
    const r = transactionSchema.safeParse({ kind: "expense", amount: 99.90, occurred_on: "2026-05-01" })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.currency).toBe("BRL")
    }
  })

  it("requires positive amount", () => {
    expect(transactionSchema.safeParse({ kind: "income", amount: 0, occurred_on: "2026-01-01" }).success).toBe(false)
  })

  it("accepts all transaction kinds", () => {
    for (const k of ["income", "expense", "transfer", "tax"] as const) {
      expect(transactionSchema.safeParse({ kind: k, amount: 50, occurred_on: "2026-01-01" }).success).toBe(true)
    }
  })

  it("rejects invalid kind", () => {
    expect(transactionSchema.safeParse({ kind: "refund", amount: 50, occurred_on: "2026-01-01" }).success).toBe(false)
  })
})

describe("accountSchema", () => {
  it("parses a valid account", () => {
    const r = accountSchema.safeParse({ name: "Nubank" })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.currency).toBe("BRL")
      expect(r.data.opening_balance).toBe(0)
    }
  })
})

describe("healthLogSchema", () => {
  it("parses weight log", () => {
    expect(healthLogSchema.safeParse({ kind: "weight", value: { kg: 70.5 } }).success).toBe(true)
  })

  it("parses blood pressure log", () => {
    expect(healthLogSchema.safeParse({ kind: "blood_pressure", value: { systolic: 120, diastolic: 80 } }).success).toBe(true)
  })

  it("parses glucose log", () => {
    expect(healthLogSchema.safeParse({ kind: "glucose", value: { mg_dl: 95, fasting: true } }).success).toBe(true)
  })

  it("parses heart rate log", () => {
    expect(healthLogSchema.safeParse({ kind: "heart_rate", value: { bpm: 72 } }).success).toBe(true)
  })

  it("accepts any object value via otherValueSchema", () => {
    expect(healthLogSchema.safeParse({ kind: "weight", value: { kg: -1 } }).success).toBe(true)
  })

  it("rejects unknown kind", () => {
    expect(healthLogSchema.safeParse({ kind: "cholesterol", value: { mg_dl: 200 } }).success).toBe(false)
  })
})

describe("pregnancySchema", () => {
  it("accepts empty object", () => {
    expect(pregnancySchema.safeParse({}).success).toBe(true)
  })

  it("accepts due_date and week", () => {
    expect(pregnancySchema.safeParse({ due_date: "2026-09-15", week: 20 }).success).toBe(true)
  })
})

describe("appointmentSchema", () => {
  it("parses a valid appointment", () => {
    expect(appointmentSchema.safeParse({ title: "Pré-natal", starts_at: "2026-05-10T14:00:00Z" }).success).toBe(true)
  })

  it("rejects empty title", () => {
    expect(appointmentSchema.safeParse({ title: "", starts_at: "2026-05-10T14:00:00Z" }).success).toBe(false)
  })
})

describe("protocolSchema", () => {
  it("parses a valid protocol", () => {
    const r = protocolSchema.safeParse({ name: "Vitamina D" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.active).toBe(true)
  })

  it("allows setting active to false", () => {
    const r = protocolSchema.safeParse({ name: "Old protocol", active: false })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.active).toBe(false)
  })
})

describe("protocolEntrySchema", () => {
  it("parses a valid entry", () => {
    expect(protocolEntrySchema.safeParse({ protocol_id: "550e8400-e29b-41d4-a716-446655440000", done_on: "2026-05-03" }).success).toBe(true)
  })

  it("requires protocol_id", () => {
    expect(protocolEntrySchema.safeParse({ done_on: "2026-05-03" }).success).toBe(false)
  })
})

describe("mealSchema", () => {
  it("parses a valid meal", () => {
    const r = mealSchema.safeParse({ name: "Salada Caesar" })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.kind).toBe("recipe")
      expect(r.data.tags).toEqual([])
      expect(r.data.ingredients).toEqual([])
    }
  })

  it("rejects empty name", () => {
    expect(mealSchema.safeParse({ name: "" }).success).toBe(false)
  })

  it("accepts optional fields", () => {
    expect(mealSchema.safeParse({ name: "X", prep_time: 15, notes: "nota" }).success).toBe(true)
  })
})

describe("mealPlanSchema", () => {
  it("parses a valid meal plan", () => {
    const r = mealPlanSchema.safeParse({ date: "2026-05-06", meal_type: "lunch" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.meal_id).toBeNull()
  })

  it("rejects invalid meal_type", () => {
    expect(mealPlanSchema.safeParse({ date: "2026-05-06", meal_type: "brunch" }).success).toBe(false)
  })
})

describe("noteSchema", () => {
  it("parses a valid note", () => {
    const r = noteSchema.safeParse({ title: "Ideia" })
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data.pinned).toBe(false)
      expect(r.data.tags).toEqual([])
    }
  })

  it("rejects empty title", () => {
    expect(noteSchema.safeParse({ title: "" }).success).toBe(false)
  })
})

describe("habitTrackSchema", () => {
  it("parses a valid habit", () => {
    const r = habitTrackSchema.safeParse({ name: "Beber água" })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.active).toBe(true)
  })

  it("rejects empty name", () => {
    expect(habitTrackSchema.safeParse({ name: "" }).success).toBe(false)
  })
})

describe("habitEntrySchema", () => {
  it("parses a valid entry", () => {
    expect(habitEntrySchema.safeParse({ habit_id: "550e8400-e29b-41d4-a716-446655440000", done_on: "2026-05-06" }).success).toBe(true)
  })

  it("requires habit_id", () => {
    expect(habitEntrySchema.safeParse({ done_on: "2026-05-06" }).success).toBe(false)
  })
})

describe("people schemas", () => {
  it("aceita uma pessoa mínima e aplica os defaults", () => {
    const parsed = personSchema.parse({ name: "Tia Rosa" })
    expect(parsed.side).toBe("outro")
    expect(parsed.circle).toBe("outro")
    expect(parsed.tags).toEqual([])
  })

  it("rejeita pessoa sem nome", () => {
    expect(personSchema.safeParse({ name: "" }).success).toBe(false)
  })

  it("exige excluded_person_id quando invite_policy é excluir_um", () => {
    const semExcluido = personConflictSchema.safeParse({
      subject_id: "11111111-1111-1111-a111-111111111111",
      object_id: "22222222-2222-2222-a222-222222222222",
      invite_policy: "excluir_um",
    })
    expect(semExcluido.success).toBe(false)
  })

  it("aceita excluir_um com o excluído sendo uma das pontas", () => {
    const ok = personConflictSchema.safeParse({
      subject_id: "11111111-1111-1111-a111-111111111111",
      object_id: "22222222-2222-2222-a222-222222222222",
      invite_policy: "excluir_um",
      excluded_person_id: "11111111-1111-1111-a111-111111111111",
    })
    expect(ok.success).toBe(true)
  })

  it("rejeita excluído que não é subject nem object", () => {
    const forasteiro = personConflictSchema.safeParse({
      subject_id: "11111111-1111-1111-a111-111111111111",
      object_id: "22222222-2222-2222-a222-222222222222",
      invite_policy: "excluir_um",
      excluded_person_id: "33333333-3333-3333-a333-333333333333",
    })
    expect(forasteiro.success).toBe(false)
  })

  it("rejeita conflito de uma pessoa com ela mesma", () => {
    const mesmo = personConflictSchema.safeParse({
      subject_id: "11111111-1111-1111-a111-111111111111",
      object_id: "11111111-1111-1111-a111-111111111111",
      invite_policy: "nao_juntos",
    })
    expect(mesmo.success).toBe(false)
  })

  it("aceita handling combinado", () => {
    const parsed = personConflictSchema.parse({
      subject_id: "11111111-1111-1111-a111-111111111111",
      object_id: "22222222-2222-2222-a222-222222222222",
      invite_policy: "ok_com_ressalva",
      handling: ["avisar_antes", "separar_no_evento"],
    })
    expect(parsed.handling).toHaveLength(2)
  })

  it("convite nasce como cogitado", () => {
    const parsed = guestInviteSchema.parse({
      event_id: "11111111-1111-1111-a111-111111111111",
      person_id: "22222222-2222-2222-a222-222222222222",
    })
    expect(parsed.status).toBe("cogitado")
    expect(parsed.plus_ones).toBe(0)
  })
})
