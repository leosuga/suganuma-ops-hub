// Types shared across MCP server implementation

export interface McpToolContext {
  ownerId: string
  baseUrl: string
  token: string
}

export interface AgentApiResponse<T = unknown> {
  data?: T
  error?: string
  status: number
}
