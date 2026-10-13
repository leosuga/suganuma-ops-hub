// Sessão MCP desconhecida precisa virar 404 (spec Streamable HTTP): é o sinal
// que faz o cliente reabrir a sessão. Com 400 o cliente fica preso após um
// redeploy, que zera o Map de sessões em memória.
import { describe, it, expect } from "vitest"
import { classifySessionRequest } from "@/lib/mcp/session"

describe("classifySessionRequest", () => {
  it("reutiliza a sessão quando o id é conhecido", () => {
    expect(
      classifySessionRequest({ sessionId: "abc", hasSession: true, isInitialize: false })
    ).toBe("reuse")
  })

  it("abre sessão nova só quando não há id e a requisição é initialize", () => {
    expect(
      classifySessionRequest({ sessionId: undefined, hasSession: false, isInitialize: true })
    ).toBe("init")
  })

  it("devolve not_found quando o id existe mas a sessão sumiu (redeploy/TTL)", () => {
    expect(
      classifySessionRequest({ sessionId: "velho", hasSession: false, isInitialize: false })
    ).toBe("not_found")
  })

  it("devolve not_found mesmo se um id desconhecido vier com initialize", () => {
    expect(
      classifySessionRequest({ sessionId: "velho", hasSession: false, isInitialize: true })
    ).toBe("not_found")
  })

  it("devolve bad_request sem id e sem initialize", () => {
    expect(
      classifySessionRequest({ sessionId: undefined, hasSession: false, isInitialize: false })
    ).toBe("bad_request")
  })
})
