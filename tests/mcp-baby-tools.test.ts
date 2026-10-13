import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/mcp/api", () => ({ agentApi: vi.fn(async () => ({ ok: true })) }))

import { agentApi } from "@/lib/mcp/api"
import { createTools } from "@/lib/mcp/tools"

const ctx = { ownerId: "o", token: "tok", scopes: [], baseUrl: "http://x" }
const tool = (name: string) => {
  const t = createTools().find((x) => x.name === name)
  if (!t) throw new Error(`tool ${name} não registrada`)
  return t
}

beforeEach(() => vi.mocked(agentApi).mockClear())

describe("tools MCP da bebê", () => {
  it("registra as três tools, duas somente-leitura", () => {
    expect(tool("baby_summary").annotations?.readOnlyHint).toBe(true)
    expect(tool("baby_list_logs").annotations?.readOnlyHint).toBe(true)
    expect(tool("baby_log_event").annotations?.readOnlyHint).toBeUndefined()
  })

  it("baby_summary faz GET /api/agent/baby", async () => {
    await tool("baby_summary").handler({}, ctx)
    expect(agentApi).toHaveBeenCalledWith("tok", "GET", "/api/agent/baby")
  })

  it("baby_log_event faz POST dos logs com o corpo validado", async () => {
    await tool("baby_log_event").handler(
      { kind: "feed", at: "2026-10-13T06:00:00Z", data: { method: "breast", side: "L" } },
      ctx,
    )
    expect(agentApi).toHaveBeenCalledWith("tok", "POST", "/api/agent/baby/logs", {
      kind: "feed",
      at: "2026-10-13T06:00:00Z",
      data: { method: "breast", side: "L" },
    })
  })

  it("baby_log_event rejeita kind inválido sem chamar a API", async () => {
    await expect(tool("baby_log_event").handler({ kind: "banho", data: {} }, ctx)).rejects.toThrow()
    expect(agentApi).not.toHaveBeenCalled()
  })

  it("baby_list_logs repassa filtros como query", async () => {
    await tool("baby_list_logs").handler({ kind: "diaper", limit: 10 }, ctx)
    expect(agentApi).toHaveBeenCalledWith("tok", "GET", "/api/agent/baby/logs", undefined, {
      kind: "diaper",
      since: undefined,
      limit: "10",
    })
  })
})
