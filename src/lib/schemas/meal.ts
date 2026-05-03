import { z } from "zod"

export const mealSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  kind: z.string().default("recipe"),
  tags: z.array(z.string()).default([]),
  ingredients: z.array(z.string()).default([]),
  prep_time: z.number().int().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export const mealPlanSchema = z.object({
  id: z.string().uuid().optional(),
  meal_id: z.string().uuid().optional().nullable(),
  date: z.string(),
  meal_type: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  notes: z.string().optional().nullable(),
})

export type Meal = z.infer<typeof mealSchema>
export type MealPlan = z.infer<typeof mealPlanSchema>
