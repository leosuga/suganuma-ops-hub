import { z } from "zod"
import { agentApi } from "./api"
import type { McpToolContext } from "./types"

// Reuse canonical schemas for input validation and JSON Schema generation.
import { taskSchema } from "@/lib/schemas/task"
import { transactionSchema } from "@/lib/schemas/finance"
import { healthLogSchema, appointmentSchema } from "@/lib/schemas/health"
import { noteSchema } from "@/lib/schemas/note"
import { mealSchema, mealPlanSchema } from "@/lib/schemas/meal"
import { habitTrackSchema, habitEntrySchema } from "@/lib/schemas/habit"

// ---------- Schemas for tool inputs (pick/omit from canonical schemas) ----------

const tasksListSchema = z.object({
  status: z.enum(["todo", "doing", "done", "archived"]).optional(),
  priority: z.enum(["low", "med", "high", "urgent"]).optional(),
  limit: z.number().int().min(1).max(200).optional().describe("Maximum tasks to return (default 50)"),
})

const tasksCreateSchema = taskSchema.pick({
  title: true,
  notes: true,
  category: true,
  priority: true,
  due_at: true,
})

const tasksUpdateSchema = z.object({
  id: z.string().uuid(),
}).merge(
  taskSchema.pick({
    title: true,
    notes: true,
    status: true,
    priority: true,
    due_at: true,
  }).partial()
)

const taskByIdSchema = z.object({ id: z.string().uuid() })

const financeSummarySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM, default current month"),
})

const financeAddTransactionSchema = transactionSchema.omit({ id: true })

const healthLogBiometricSchema = healthLogSchema.omit({ id: true })

const healthBiometricsSchema = z.object({
  kind: z.enum(["weight", "blood_pressure", "glucose", "temperature", "heart_rate", "other"]).optional(),
  since: z.string().datetime().optional().describe("ISO datetime to filter logs from"),
  limit: z.number().int().min(1).max(500).optional().describe("Maximum logs to return (default 50)"),
})

const healthAppointmentsSchema = z.object({
  since: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(200).optional(),
})

const healthCreateAppointmentSchema = appointmentSchema.omit({ id: true })

const notesListSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
})

const notesCreateSchema = noteSchema.pick({
  title: true,
  content: true,
  tags: true,
  pinned: true,
})

const notesUpdateSchema = z.object({
  id: z.string().uuid(),
}).merge(
  noteSchema.pick({
    title: true,
    content: true,
    tags: true,
    pinned: true,
  }).partial()
)

const noteByIdSchema = z.object({ id: z.string().uuid() })

const mealsListSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
})

const mealsCreateSchema = mealSchema.omit({ id: true })

const mealsSetPlanSchema = mealPlanSchema.omit({ id: true })

const mealsGetPlanSchema = z.object({
  week_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Monday of the week YYYY-MM-DD"),
})

const habitsListSchema = z.object({
  limit: z.number().int().min(1).max(200).optional(),
})

const habitsCreateSchema = habitTrackSchema.omit({ id: true })

const habitLogEntrySchema = z.object({
  habit_id: z.string().uuid(),
}).merge(habitEntrySchema.omit({ id: true, habit_id: true }))

const habitsListEntriesSchema = z.object({
  habit_id: z.string().uuid(),
  limit: z.number().int().min(1).max(500).optional(),
})

const dashboardSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("YYYY-MM, default current month"),
})

// ---------- Tool registry ----------

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema?: z.ZodTypeAny | Record<string, z.ZodTypeAny>
  handler: (args: unknown, ctx: McpToolContext) => Promise<unknown>
  annotations?: {
    readOnlyHint?: boolean
    destructiveHint?: boolean
    openWorldHint?: boolean
  }
}

function formatResult(result: unknown): string {
  return JSON.stringify(result, null, 2)
}

export function createTools(): McpToolDefinition[] {
  return [
    // Tasks
    {
      name: "tasks_list",
      description: "Lista tasks do usuario. Filtre por status (todo|doing|done|archived) e/ou priority (low|med|high|urgent).",
      inputSchema: tasksListSchema,
      handler: async (args, ctx) => {
        const { status, priority, limit } = tasksListSchema.parse(args)
        const result = await agentApi(ctx.token, "GET", "/api/agent/tasks", undefined, {
          status,
          priority,
          limit: limit?.toString(),
        })
        return formatResult(result)
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "tasks_create",
      description: "Cria uma nova task.",
      inputSchema: tasksCreateSchema,
      handler: async (args, ctx) => {
        const body = tasksCreateSchema.parse(args)
        const result = await agentApi(ctx.token, "POST", "/api/agent/tasks", body)
        return formatResult(result)
      },
    },
    {
      name: "tasks_update",
      description: "Atualiza campos de uma task pelo ID.",
      inputSchema: tasksUpdateSchema,
      handler: async (args, ctx) => {
        const { id, ...body } = tasksUpdateSchema.parse(args)
        const result = await agentApi(ctx.token, "PATCH", `/api/agent/tasks/${id}`, body)
        return formatResult(result)
      },
    },
    {
      name: "tasks_complete",
      description: "Marca uma task como concluida pelo ID.",
      inputSchema: taskByIdSchema,
      handler: async (args, ctx) => {
        const { id } = taskByIdSchema.parse(args)
        const result = await agentApi(ctx.token, "POST", `/api/agent/tasks/${id}/complete`)
        return formatResult(result)
      },
    },

    // Finance
    {
      name: "finance_summary",
      description: "Retorna KPIs financeiros (receita, despesas, saldo) de um mes (YYYY-MM).",
      inputSchema: financeSummarySchema,
      handler: async (args, ctx) => {
        const { month } = financeSummarySchema.parse(args)
        const result = await agentApi(ctx.token, "GET", "/api/agent/finance/summary", undefined, { month })
        return formatResult(result)
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "finance_add_transaction",
      description: "Registra uma transacao financeira.",
      inputSchema: financeAddTransactionSchema,
      handler: async (args, ctx) => {
        const body = financeAddTransactionSchema.parse(args)
        const result = await agentApi(ctx.token, "POST", "/api/agent/finance/transactions", body)
        return formatResult(result)
      },
    },

    // Health
    {
      name: "health_log_biometric",
      description: "Registra uma medicao biometrica (peso, pressao, glicose, temperatura, frequencia cardiaca).",
      inputSchema: healthLogBiometricSchema,
      handler: async (args, ctx) => {
        const body = healthLogBiometricSchema.parse(args)
        const result = await agentApi(ctx.token, "POST", "/api/agent/health/log", body)
        return formatResult(result)
      },
    },
    {
      name: "health_biometrics",
      description: "Consulta historico de medicoes biometricas.",
      inputSchema: healthBiometricsSchema,
      handler: async (args, ctx) => {
        const { kind, since, limit } = healthBiometricsSchema.parse(args)
        const result = await agentApi(ctx.token, "GET", "/api/agent/health/biometrics", undefined, {
          kind,
          since,
          limit: limit?.toString(),
        })
        return formatResult(result)
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "health_list_appointments",
      description: "Lista proximas consultas medicas.",
      inputSchema: healthAppointmentsSchema,
      handler: async (args, ctx) => {
        const { since, limit } = healthAppointmentsSchema.parse(args)
        const result = await agentApi(ctx.token, "GET", "/api/agent/health/appointments", undefined, {
          since,
          limit: limit?.toString(),
        })
        return formatResult(result)
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "health_create_appointment",
      description: "Agenda uma nova consulta medica.",
      inputSchema: healthCreateAppointmentSchema,
      handler: async (args, ctx) => {
        const body = healthCreateAppointmentSchema.parse(args)
        const result = await agentApi(ctx.token, "POST", "/api/agent/health/appointments", body)
        return formatResult(result)
      },
    },

    // Notes
    {
      name: "notes_list",
      description: "Lista notas do usuario.",
      inputSchema: notesListSchema,
      handler: async (args, ctx) => {
        const { limit } = notesListSchema.parse(args)
        const result = await agentApi(ctx.token, "GET", "/api/agent/notes", undefined, {
          limit: limit?.toString(),
        })
        return formatResult(result)
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "notes_create",
      description: "Cria uma nova nota.",
      inputSchema: notesCreateSchema,
      handler: async (args, ctx) => {
        const body = notesCreateSchema.parse(args)
        const result = await agentApi(ctx.token, "POST", "/api/agent/notes", body)
        return formatResult(result)
      },
    },
    {
      name: "notes_update",
      description: "Atualiza uma nota pelo ID.",
      inputSchema: notesUpdateSchema,
      handler: async (args, ctx) => {
        const { id, ...body } = notesUpdateSchema.parse(args)
        const result = await agentApi(ctx.token, "PATCH", `/api/agent/notes/${id}`, body)
        return formatResult(result)
      },
    },
    {
      name: "notes_delete",
      description: "Exclui uma nota pelo ID.",
      inputSchema: noteByIdSchema,
      handler: async (args, ctx) => {
        const { id } = noteByIdSchema.parse(args)
        await agentApi(ctx.token, "DELETE", `/api/agent/notes/${id}`)
        return `Nota ${id} excluida com sucesso.`
      },
      annotations: { destructiveHint: true },
    },

    // Meals
    {
      name: "meals_list",
      description: "Lista refeicoes cadastradas.",
      inputSchema: mealsListSchema,
      handler: async (args, ctx) => {
        const { limit } = mealsListSchema.parse(args)
        const result = await agentApi(ctx.token, "GET", "/api/agent/meals", undefined, {
          limit: limit?.toString(),
        })
        return formatResult(result)
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "meals_create",
      description: "Cria uma nova refeicao.",
      inputSchema: mealsCreateSchema,
      handler: async (args, ctx) => {
        const body = mealsCreateSchema.parse(args)
        const result = await agentApi(ctx.token, "POST", "/api/agent/meals", body)
        return formatResult(result)
      },
    },
    {
      name: "meals_set_plan",
      description: "Define um item no plano de refeicoes.",
      inputSchema: mealsSetPlanSchema,
      handler: async (args, ctx) => {
        const body = mealsSetPlanSchema.parse(args)
        const result = await agentApi(ctx.token, "POST", "/api/agent/meals/plans", body)
        return formatResult(result)
      },
    },
    {
      name: "meals_get_plan",
      description: "Retorna o plano de refeicoes de uma semana.",
      inputSchema: mealsGetPlanSchema,
      handler: async (args, ctx) => {
        const { week_start } = mealsGetPlanSchema.parse(args)
        const result = await agentApi(ctx.token, "GET", "/api/agent/meals/plans", undefined, { week_start })
        return formatResult(result)
      },
      annotations: { readOnlyHint: true },
    },

    // Habits
    {
      name: "habits_list",
      description: "Lista habitos cadastrados.",
      inputSchema: habitsListSchema,
      handler: async (args, ctx) => {
        const { limit } = habitsListSchema.parse(args)
        const result = await agentApi(ctx.token, "GET", "/api/agent/habits", undefined, {
          limit: limit?.toString(),
        })
        return formatResult(result)
      },
      annotations: { readOnlyHint: true },
    },
    {
      name: "habits_create",
      description: "Cria um novo habito.",
      inputSchema: habitsCreateSchema,
      handler: async (args, ctx) => {
        const body = habitsCreateSchema.parse(args)
        const result = await agentApi(ctx.token, "POST", "/api/agent/habits", body)
        return formatResult(result)
      },
    },
    {
      name: "habits_log_entry",
      description: "Registra uma entrada de habito.",
      inputSchema: habitLogEntrySchema,
      handler: async (args, ctx) => {
        const { habit_id, ...body } = habitLogEntrySchema.parse(args)
        const result = await agentApi(ctx.token, "POST", `/api/agent/habits/${habit_id}/entries`, body)
        return formatResult(result)
      },
    },
    {
      name: "habits_list_entries",
      description: "Lista entradas de um habito.",
      inputSchema: habitsListEntriesSchema,
      handler: async (args, ctx) => {
        const { habit_id, limit } = habitsListEntriesSchema.parse(args)
        const result = await agentApi(ctx.token, "GET", `/api/agent/habits/${habit_id}/entries`, undefined, {
          limit: limit?.toString(),
        })
        return formatResult(result)
      },
      annotations: { readOnlyHint: true },
    },

    // Dashboard
    {
      name: "dashboard_get",
      description: "Retorna um snapshot consolidado cross-domain: tasks, finance, appointments, health.",
      inputSchema: dashboardSchema,
      handler: async (args, ctx) => {
        const { month } = dashboardSchema.parse(args)
        const result = await agentApi(ctx.token, "GET", "/api/agent/dashboard", undefined, { month })
        return formatResult(result)
      },
      annotations: { readOnlyHint: true },
    },
  ]
}
