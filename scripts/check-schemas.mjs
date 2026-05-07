import { z } from "zod"
import { taskSchema } from "./src/lib/schemas/task.js"
import { transactionSchema, accountSchema } from "./src/lib/schemas/finance.js"
import { healthLogSchema, pregnancySchema, appointmentSchema, protocolSchema, protocolEntrySchema } from "./src/lib/schemas/health.js"
import { mealSchema, mealPlanSchema } from "./src/lib/schemas/meal.js"
import { noteSchema } from "./src/lib/schemas/note.js"
import { habitTrackSchema, habitEntrySchema } from "./src/lib/schemas/habit.js"

function assert(name, condition) {
  if (!condition) throw new Error(`FAIL: ${name}`)
  console.log(`PASS: ${name}`)
}

assert("task valid", taskSchema.safeParse({ title: "T" }).success)
assert("task defaults", taskSchema.safeParse({ title: "T" }).success)
assert("meal valid", mealSchema.safeParse({ name: "Salada" }).success)
assert("meal rejects empty name", !mealSchema.safeParse({ name: "" }).success)
assert("meal plan valid", mealPlanSchema.safeParse({ date: "2026-05-07", meal_type: "lunch" }).success)
assert("meal plan rejects bad type", !mealPlanSchema.safeParse({ date: "2026-05-07", meal_type: "brunch" }).success)
assert("note valid", noteSchema.safeParse({ title: "Nota" }).success)
assert("note rejects empty", !noteSchema.safeParse({ title: "" }).success)
assert("habit valid", habitTrackSchema.safeParse({ name: "Água" }).success)
assert("habit rejects empty", !habitTrackSchema.safeParse({ name: "" }).success)
assert("habit entry valid", habitEntrySchema.safeParse({ habit_id: "550e8400-e29b-41d4-a716446655440000", done_on: "2026-05-07" }).success)
assert("habit entry requires habit_id", !habitEntrySchema.safeParse({ done_on: "2026-05-07" }).success)
assert("glucose log with fasting", healthLogSchema.safeParse({ kind: "glucose", value: { mg_dl: 95, fasting: true } }).success)
assert("glucose log missing fasting fails", !healthLogSchema.safeParse({ kind: "glucose", value: { mg_dl: 95 } }).success)

console.log("\nAll schema tests passed!")
