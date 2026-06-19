import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createTools, type McpToolDefinition } from "./tools"
import { logger } from "@/lib/logger"
import { logMcpToolCall } from "./audit"
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
    // The MCP SDK accepts Zod schemas (v3 or v4) directly as inputSchema;
    // it handles JSON Schema conversion internally via zod-json-schema-compat.
    server.registerTool(
      tool.name,
      {
        title: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as McpToolDefinition["inputSchema"],
        annotations: tool.annotations,
      },
      async (args: unknown) => {
        const start = Date.now()
        try {
          const result = await tool.handler(args, ctx)
          await logMcpToolCall({
            ownerId: ctx.ownerId,
            toolName: tool.name,
            args,
            success: true,
            durationMs: Date.now() - start,
          })
          return {
            content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
            isError: false,
          }
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err)
          logger.error("mcp", `Tool ${tool.name} failed`, { error })
          await logMcpToolCall({
            ownerId: ctx.ownerId,
            toolName: tool.name,
            args,
            success: false,
            error,
            durationMs: Date.now() - start,
          })
          return {
            content: [{ type: "text", text: `Erro na tool ${tool.name}: ${error}` }],
            isError: true,
          }
        }
      }
    )
  }

  return server
}
