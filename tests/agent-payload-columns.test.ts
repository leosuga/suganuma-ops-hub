// Rotas de agente: o payload não pode carregar `search_vector`.
//
// `select("*")` devolvia o tsvector da busca híbrida (migration 0033) em toda
// resposta de /api/agent/notes e /api/agent/tasks — campo que só cresce com o
// conteúdo da linha, nunca é lido pelo consumidor e consome contexto de todo
// cliente MCP. Aqui o cliente Supabase falso PROJETA as linhas pelas colunas
// pedidas: se a rota voltar a usar "*", `search_vector` reaparece na resposta e
// o teste quebra.
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/service", () => ({ createServiceClient: vi.fn() }))
vi.mock("@/lib/agent-auth", () => ({
  validateAgentToken: vi.fn(async () => "owner-1"),
  unauthorized: () => Response.json({ error: "unauthorized" }, { status: 401 }),
  badRequest: (msg: string) => Response.json({ error: msg }, { status: 400 }),
  serverError: (msg: string) => Response.json({ error: msg }, { status: 500 }),
  validateUuidParam: () => true,
}))
vi.mock("@/lib/actions/notes", () => ({ createNoteWithEmbedding: vi.fn() }))
vi.mock("@/lib/actions/semantic-search", () => ({
  syncNoteEmbeddingForOwner: vi.fn(),
  syncNoteEmbedding: vi.fn(),
  syncNoteEmbeddings: vi.fn(),
  deleteNoteEmbedding: vi.fn(),
  deleteNoteEmbeddings: vi.fn(),
}))

import { createServiceClient } from "@/lib/supabase/service"
import { GET as getNotes } from "@/app/api/agent/notes/route"
import { GET as getTasks } from "@/app/api/agent/tasks/route"
import { POST as completeTask } from "@/app/api/agent/tasks/[id]/complete/route"

const mockCreateServiceClient = createServiceClient as unknown as ReturnType<typeof vi.fn>

type Row = Record<string, unknown>

const NOTE_ROW: Row = {
  id: "note-1",
  owner_id: "owner-1",
  title: "data drift em produção",
  content: "resumo",
  tags: ["drift"],
  pinned: false,
  linked_task_id: null,
  para: "resources",
  daily_date: null,
  is_moc: false,
  last_review: null,
  project_id: null,
  favorited: false,
  attachments: [],
  created_at: "2026-11-04T00:00:00.000Z",
  updated_at: "2026-11-04T00:00:00.000Z",
  search_vector: "'drift':1 'producao':4",
}

const TASK_ROW: Row = {
  id: "task-1",
  owner_id: "owner-1",
  title: "revisar drift",
  notes: null,
  category: "personal",
  status: "todo",
  priority: "med",
  due_at: null,
  completed_at: null,
  project_id: null,
  delegated_to: null,
  important: false,
  recurrence: null,
  tags: ["drift"],
  linked_note_id: null,
  energy_level: "med",
  created_at: "2026-11-04T00:00:00.000Z",
  updated_at: "2026-11-04T00:00:00.000Z",
  search_vector: "'drift':2 'revisar':1",
}

/** Projeta a linha pelas colunas pedidas — é o que o PostgREST faz de verdade. */
function project(row: Row, columns: string | null): Row {
  if (!columns || columns.trim() === "*") return { ...row }
  const out: Row = {}
  for (const key of columns.split(",").map((c) => c.trim()).filter(Boolean)) {
    if (key in row) out[key] = row[key]
  }
  return out
}

function fakeClient(rows: Row[]) {
  const selected: string[] = []

  const client = {
    from: () => {
      let columns: string | null = null
      const chain = {
        select: (cols: string) => {
          selected.push(cols)
          columns = cols
          return chain
        },
        eq: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => chain,
        update: () => chain,
        insert: () => chain,
        single: () => Promise.resolve({ data: project(rows[0], columns), error: null }),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
          Promise.resolve({ data: rows.map((r) => project(r, columns)), error: null }).then(resolve, reject),
      }
      return chain
    },
  }

  return { client, selected }
}

function reqWithQuery(url: string) {
  return { nextUrl: new URL(url) } as never
}

describe("payload das rotas de agente", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("GET /api/agent/notes não devolve search_vector e mantém os campos das tools", async () => {
    const { client, selected } = fakeClient([NOTE_ROW])
    mockCreateServiceClient.mockReturnValue(client as never)

    const res = await getNotes(reqWithQuery("http://localhost/api/agent/notes?limit=5"))
    const body = (await res.json()) as { notes: Row[] }

    expect(selected).toHaveLength(1)
    expect(selected[0]).not.toContain("*")
    expect(body.notes[0]).not.toHaveProperty("search_vector")
    // Campos que o notes_list (MCP) e a UI consomem.
    for (const field of ["id", "title", "content", "tags", "para", "is_moc", "updated_at"]) {
      expect(body.notes[0]).toHaveProperty(field)
    }
  })

  it("GET /api/agent/tasks não devolve search_vector e mantém os campos das tools", async () => {
    const { client, selected } = fakeClient([TASK_ROW])
    mockCreateServiceClient.mockReturnValue(client as never)

    const res = await getTasks(reqWithQuery("http://localhost/api/agent/tasks?limit=5"))
    const body = (await res.json()) as { tasks: Row[] }

    expect(selected).toHaveLength(1)
    expect(selected[0]).not.toContain("*")
    expect(body.tasks[0]).not.toHaveProperty("search_vector")
    for (const field of ["id", "title", "status", "priority", "due_at", "category", "tags", "energy_level"]) {
      expect(body.tasks[0]).toHaveProperty(field)
    }
  })

  it("POST /api/agent/tasks/:id/complete devolve a task sem search_vector", async () => {
    const { client } = fakeClient([{ ...TASK_ROW, status: "done" }])
    mockCreateServiceClient.mockReturnValue(client as never)

    const res = await completeTask(
      { nextUrl: new URL("http://localhost/api/agent/tasks/task-1/complete") } as never,
      { params: Promise.resolve({ id: "11111111-1111-1111-1111-111111111111" }) },
    )
    const body = (await res.json()) as Row

    expect(body).not.toHaveProperty("search_vector")
    expect(body.status).toBe("done")
    expect(body.title).toBe("revisar drift")
  })
})
