export type SessionDecision = "reuse" | "init" | "not_found" | "bad_request"

/**
 * Decide o destino de uma requisição MCP conforme a sessão.
 *
 * Um session-id presente mas desconhecido é "not_found" (404), não "bad_request":
 * a spec do Streamable HTTP usa o 404 para o cliente reabrir a sessão com um
 * novo initialize. O Map de sessões é em memória e zera a cada deploy.
 */
export function classifySessionRequest(input: {
  sessionId: string | undefined
  hasSession: boolean
  isInitialize: boolean
}): SessionDecision {
  if (input.hasSession) return "reuse"
  if (input.sessionId) return "not_found"
  return input.isInitialize ? "init" : "bad_request"
}
