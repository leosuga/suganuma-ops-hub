#!/usr/bin/env node
/**
 * MCP server stdio para Suganuma Ops Hub.
 * Requer vars de ambiente:
 *   OPS_HUB_URL   — ex: https://ops.suganuma.com.br
 *   OPS_HUB_TOKEN — token gerado em /settings (prefixo ops_)
 *
 * Uso no Claude Desktop (~/.config/claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "ops-hub": {
 *       "command": "node",
 *       "args": ["/caminho/para/mcp-server/dist/index.js"],
 *       "env": {
 *         "OPS_HUB_URL": "https://ops.suganuma.com.br",
 *         "OPS_HUB_TOKEN": "ops_..."
 *       }
 *     }
 *   }
 * }
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"

const BASE_URL = process.env.OPS_HUB_URL ?? "https://ops.suganuma.com.br"
const TOKEN = process.env.OPS_HUB_TOKEN ?? ""

if (!TOKEN) {
  process.stderr.write("ERROR: OPS_HUB_TOKEN env var is required\n")
  process.exit(1)
}

async function api<T>(method: string, path: string, body?: unknown, params?: Record<string, string>): Promise<T> {
  const url = new URL(path, BASE_URL)
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(`API error ${res.status}: ${(err as { error?: string }).error ?? "unknown"}`)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

const server = new Server(
  { name: "ops-hub", version: "0.1.0" },
  { capabilities: { tools: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "tasks_list",
      description: "Lista tasks do usuário. Filtre por status (todo|doing|done|archived) e/ou priority (low|med|high|urgent).",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["todo", "doing", "done", "archived"] },
          priority: { type: "string", enum: ["low", "med", "high", "urgent"] },
          limit: { type: "number", default: 50 },
        },
      },
    },
    {
      name: "tasks_create",
      description: "Cria uma nova task.",
      inputSchema: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string" },
          notes: { type: "string" },
          category: { type: "string", enum: ["finance", "logistics", "personal", "health"] },
          priority: { type: "string", enum: ["low", "med", "high", "urgent"] },
          due_at: { type: "string", description: "ISO 8601 datetime" },
        },
      },
    },
    {
      name: "tasks_complete",
      description: "Marca uma task como concluída pelo ID.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
    {
      name: "tasks_update",
      description: "Atualiza campos de uma task pelo ID.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          status: { type: "string", enum: ["todo", "doing", "done", "archived"] },
          priority: { type: "string", enum: ["low", "med", "high", "urgent"] },
          notes: { type: "string" },
          due_at: { type: "string" },
        },
      },
    },
    {
      name: "finance_summary",
      description: "Retorna KPIs financeiros (receita, despesas, saldo) de um mês (YYYY-MM).",
      inputSchema: {
        type: "object",
        properties: { month: { type: "string", description: "YYYY-MM, padrão: mês atual" } },
      },
    },
    {
      name: "finance_add_transaction",
      description: "Registra uma transação financeira.",
      inputSchema: {
        type: "object",
        required: ["kind", "amount", "occurred_on"],
        properties: {
          kind: { type: "string", enum: ["income", "expense", "transfer", "tax"] },
          amount: { type: "number" },
          occurred_on: { type: "string", description: "YYYY-MM-DD" },
          category: { type: "string" },
          description: { type: "string" },
        },
      },
    },
    {
      name: "health_log_biometric",
      description: "Registra uma medição biométrica (peso, pressão, glicose, etc).",
      inputSchema: {
        type: "object",
        required: ["kind", "value"],
        properties: {
          kind: { type: "string", enum: ["weight", "blood_pressure", "glucose", "heart_rate", "temperature", "other"] },
          value: { type: "object", description: "Ex: { kg: 70.5 } para weight, { systolic: 120, diastolic: 80 } para blood_pressure" },
          logged_at: { type: "string", description: "ISO 8601, padrão: agora" },
        },
      },
    },
    {
      name: "health_biometrics",
      description: "Consulta histórico de medições biométricas.",
      inputSchema: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["weight", "blood_pressure", "glucose", "heart_rate", "temperature"] },
          since: { type: "string", description: "ISO 8601 datetime" },
          limit: { type: "number", default: 100 },
        },
      },
    },
    {
      name: "health_create_appointment",
      description: "Agenda uma consulta médica.",
      inputSchema: {
        type: "object",
        required: ["title", "starts_at"],
        properties: {
          title: { type: "string" },
          starts_at: { type: "string", description: "ISO 8601 datetime" },
          location: { type: "string" },
          kind: { type: "string" },
        },
      },
    },
    {
      name: "dashboard_get",
      description: "Retorna snapshot consolidado: tasks, finanças do mês, próximas consultas e logs recentes.",
      inputSchema: {
        type: "object",
        properties: { month: { type: "string", description: "YYYY-MM" } },
      },
    },
    {
      name: "notes_list",
      description: "Lista notas do usuário.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", default: 50 },
        },
      },
    },
    {
      name: "notes_create",
      description: "Cria uma nova nota.",
      inputSchema: {
        type: "object",
        required: ["title"],
        properties: {
          title: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          pinned: { type: "boolean" },
        },
      },
    },
    {
      name: "notes_update",
      description: "Atualiza uma nota pelo ID.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          content: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          pinned: { type: "boolean" },
        },
      },
    },
    {
      name: "notes_delete",
      description: "Remove uma nota pelo ID.",
      inputSchema: {
        type: "object",
        required: ["id"],
        properties: { id: { type: "string" } },
      },
    },
    {
      name: "meals_list",
      description: "Lista refeições/meals.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", default: 50 },
        },
      },
    },
    {
      name: "meals_create",
      description: "Cadastra uma refeição.",
      inputSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          kind: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
          ingredients: { type: "array", items: { type: "string" } },
          prep_time: { type: "number" },
          notes: { type: "string" },
        },
      },
    },
    {
      name: "meals_set_plan",
      description: "Define o plano de refeição para uma data/tipo.",
      inputSchema: {
        type: "object",
        required: ["date", "meal_type"],
        properties: {
          date: { type: "string", description: "YYYY-MM-DD" },
          meal_type: { type: "string", enum: ["breakfast", "lunch", "dinner", "snack"] },
          meal_id: { type: "string", description: "UUID da refeição ou null" },
          notes: { type: "string" },
        },
      },
    },
    {
      name: "habits_list",
      description: "Lista hábitos do usuário.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", default: 50 },
        },
      },
    },
    {
      name: "habits_create",
      description: "Cria um novo hábito.",
      inputSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          active: { type: "boolean" },
        },
      },
    },
    {
      name: "habits_log_entry",
      description: "Registra entrada de hábito.",
      inputSchema: {
        type: "object",
        required: ["habit_id", "done_on"],
        properties: {
          habit_id: { type: "string" },
          done_on: { type: "string", description: "YYYY-MM-DD" },
          notes: { type: "string" },
        },
      },
    },
    {
      name: "health_list_appointments",
      description: "Lista consultas médicas.",
      inputSchema: {
        type: "object",
        properties: {
          since: { type: "string", description: "ISO 8601 datetime" },
          limit: { type: "number", default: 50 },
        },
      },
    },
  ],
}))

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params

  try {
    let result: unknown

    if (name === "tasks_list") {
      const params: Record<string, string> = {}
      if (args?.status) params.status = String(args.status)
      if (args?.priority) params.priority = String(args.priority)
      if (args?.limit) params.limit = String(args.limit)
      result = await api("GET", "/api/agent/tasks", undefined, params)
    } else if (name === "tasks_create") {
      result = await api("POST", "/api/agent/tasks", args)
    } else if (name === "tasks_complete") {
      result = await api("POST", `/api/agent/tasks/${args?.id}/complete`)
    } else if (name === "tasks_update") {
      const { id, ...rest } = args as { id: string; [k: string]: unknown }
      result = await api("PATCH", `/api/agent/tasks/${id}`, rest)
    } else if (name === "finance_summary") {
      const params = args?.month ? { month: String(args.month) } : undefined
      result = await api("GET", "/api/agent/finance/summary", undefined, params)
    } else if (name === "finance_add_transaction") {
      result = await api("POST", "/api/agent/finance/transactions", args)
    } else if (name === "health_log_biometric") {
      result = await api("POST", "/api/agent/health/log", args)
    } else if (name === "health_biometrics") {
      const params: Record<string, string> = {}
      if (args?.kind) params.kind = String(args.kind)
      if (args?.since) params.since = String(args.since)
      if (args?.limit) params.limit = String(args.limit)
      result = await api("GET", "/api/agent/health/biometrics", undefined, params)
    } else if (name === "health_create_appointment") {
      result = await api("POST", "/api/agent/health/appointments", args)
    } else if (name === "dashboard_get") {
      const params = args?.month ? { month: String(args.month) } : undefined
      result = await api("GET", "/api/agent/dashboard", undefined, params)
    } else if (name === "notes_list") {
      const params: Record<string, string> = {}
      if (args?.limit) params.limit = String(args.limit)
      result = await api("GET", "/api/agent/notes", undefined, params)
    } else if (name === "notes_create") {
      result = await api("POST", "/api/agent/notes", args)
    } else if (name === "notes_update") {
      const { id, ...rest } = args as { id: string; [k: string]: unknown }
      result = await api("PATCH", `/api/agent/notes/${id}`, rest)
    } else if (name === "notes_delete") {
      const { id } = args as { id: string }
      result = await api("DELETE", `/api/agent/notes/${id}`)
    } else if (name === "meals_list") {
      const params: Record<string, string> = {}
      if (args?.limit) params.limit = String(args.limit)
      result = await api("GET", "/api/agent/meals", undefined, params)
    } else if (name === "meals_create") {
      result = await api("POST", "/api/agent/meals", args)
    } else if (name === "meals_set_plan") {
      result = await api("POST", "/api/agent/meals/plans", args)
    } else if (name === "habits_list") {
      const params: Record<string, string> = {}
      if (args?.limit) params.limit = String(args.limit)
      result = await api("GET", "/api/agent/habits", undefined, params)
    } else if (name === "habits_create") {
      result = await api("POST", "/api/agent/habits", args)
    } else if (name === "habits_log_entry") {
      const { habit_id, ...rest } = args as { habit_id: string; [k: string]: unknown }
      result = await api("POST", `/api/agent/habits/${habit_id}/entries`, rest)
    } else if (name === "health_list_appointments") {
      const params: Record<string, string> = {}
      if (args?.since) params.since = String(args.since)
      if (args?.limit) params.limit = String(args.limit)
      result = await api("GET", "/api/agent/health/appointments", undefined, params)
    } else {
      throw new Error(`Tool desconhecida: ${name}`)
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Erro: ${err instanceof Error ? err.message : String(err)}` }],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`)
  process.exit(1)
})
