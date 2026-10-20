// Testes do Web Share Target (/api/capture): é a porta de entrada do
// iPhone — o SO posta title/text/url e o item precisa cair no Inbox do
// dono certo. Erro aqui = captura silenciosamente perdida.
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }))

import { createClient } from "@/lib/supabase/server"
import { POST } from "@/app/api/capture/route"

const MockCreateClient = createClient as unknown as ReturnType<typeof vi.fn>

interface Inserted {
  owner_id: string
  content: string
  source: string
}

let inserted: Inserted[] = []
let insertError: { message: string } | null = null
let user: { id: string } | null = { id: "user-1" }

function mockClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user } }),
    },
    from: () => ({
      insert: async (payload: Inserted) => {
        if (!insertError) inserted.push(payload)
        return { error: insertError }
      },
    }),
  }
}

function formRequest(fields: Record<string, string>): Request {
  const body = new URLSearchParams(fields)
  return new Request("https://ops.suganuma.com.br/api/capture", {
    method: "POST",
    body,
  })
}

describe("POST /api/capture", () => {
  beforeEach(() => {
    inserted = []
    insertError = null
    user = { id: "user-1" }
    MockCreateClient.mockImplementation(async () => mockClient() as never)
  })

  it("sem sessão: redireciona para /login e não grava nada", async () => {
    user = null
    const res = await POST(formRequest({ text: "algo" }) as never)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toContain("/login")
    expect(inserted).toHaveLength(0)
  })

  it("grava o item no Inbox com o dono da sessão", async () => {
    const res = await POST(formRequest({ text: "lembrar do médico", url: "https://x.com" }) as never)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toContain("/inbox?captured=1")
    expect(inserted).toHaveLength(1)
    expect(inserted[0].owner_id).toBe("user-1")
    expect(inserted[0].content).toContain("lembrar do médico")
    expect(inserted[0].content).toContain("https://x.com")
    expect(inserted[0].source).toBe("manual")
  })

  it("usa o title quando não vem text", async () => {
    await POST(formRequest({ title: "só título" }) as never)
    expect(inserted[0].content).toContain("só título")
  })

  it("body vazio: não grava e sinaliza", async () => {
    const res = await POST(formRequest({}) as never)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toContain("captured=empty")
    expect(inserted).toHaveLength(0)
  })

  it("falha no insert: sinaliza erro em vez de fingir sucesso", async () => {
    insertError = { message: "boom" }
    const res = await POST(formRequest({ text: "x" }) as never)
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toContain("captured=erro")
  })
})
