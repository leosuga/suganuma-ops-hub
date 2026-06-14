import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createTools } from "./tools"
import { logger } from "@/lib/logger"
import type { McpToolContext } from "./types"

export function createMcpServer(ctx: McpToolContext): McpServer {
  const server = new McpServer(
    {
      name: "ops-hub",
      version: "0.3.0",
    },
    {
      capabilities: {
        tools: { listChanged: false },
      },
    }
  )

  const tools = createTools()
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as any,
        annotations: tool.annotations,
      },
      async (args: any) => {
        try {
          const result = await tool.handler(args, ctx)
          return {
            content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
            isError: false,
          }
        } catch (err) {
          logger.error("mcp", `Tool ${tool.name} failed`, { error: err instanceof Error ? err.message : String(err) })
          return {
            content: [{ type: "text", text: `Erro na tool ${tool.name}: ${err instanceof Error ? err.message : String(err)}` }],
            isError: true,
          }
        }
      }
    )
  }

  return server
}
