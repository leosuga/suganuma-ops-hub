// Types shared across MCP server implementation

export interface McpToolContext {
  ownerId: string
  baseUrl: string
  /**
   * Bearer usado pelas tools ao chamar /api/agent/*.
   * Mutável: cada requisição HTTP revalida o portador e atualiza este campo,
   * para que um access token renovado passe a valer sem reabrir a sessão MCP.
   */
  token: string
  /** Escopos concedidos ao portador atual (ops:read, ops:write, ...). */
  scopes: string[]
}

export interface AgentApiResponse<T = unknown> {
  data?: T
  error?: string
  status: number
}
