import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { createTools, type McpToolDefinition } from "./tools"
import { createServiceClient } from "@/lib/supabase/service"
import { logger } from "@/lib/logger"
import { logMcpToolCall } from "./audit"
import type { McpToolContext } from "./types"

export function createMcpServer(ctx: McpToolContext): McpServer {
  const server = new McpServer(
    {
      name: "ops-hub",
      version: "0.4.0",
    },
    {
      capabilities: {
        tools: { listChanged: false },
        resources: { listChanged: false },
      },
    }
  )

  // ── Resources (brain://) ──────────────────────────────────
  // Read-only context for AI clients (Claude Desktop, etc.).
  // Each resource is scoped to the authenticated owner via ctx.ownerId.

  server.registerResource(
    "brain://active_projects",
    "brain://active_projects",
    {
      title: "Projetos ativos",
      description: "Lista estruturada dos projetos em andamento (status=active).",
      mimeType: "application/json",
    },
    async () => {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from("project")
        .select("id, name, description, color, status, created_at")
        .eq("owner_id", ctx.ownerId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) {
        logger.error("mcp", "Resource brain://active_projects failed", { error: error.message })
        return {
          contents: [
            {
              uri: "brain://active_projects",
              mimeType: "application/json",
              text: JSON.stringify({ error: error.message }),
            },
          ],
        }
      }

      return {
        contents: [
          {
            uri: "brain://active_projects",
            mimeType: "application/json",
            text: JSON.stringify({ projects: data ?? [] }, null, 2),
          },
        ],
      }
    }
  )

  server.registerResource(
    "brain://inbox/unprocessed",
    "brain://inbox/unprocessed",
    {
      title: "Inbox pendente",
      description: "Fila de itens do Inbox pendentes de triagem (status=unprocessed).",
      mimeType: "application/json",
    },
    async () => {
      const supabase = createServiceClient()
      const { data, error } = await supabase
        .from("inbox_item")
        .select("id, content, source, ai_payload, created_at")
        .eq("owner_id", ctx.ownerId)
        .eq("status", "unprocessed")
        .order("created_at", { ascending: false })
        .limit(20)

      if (error) {
        logger.error("mcp", "Resource brain://inbox/unprocessed failed", { error: error.message })
        return {
          contents: [
            {
              uri: "brain://inbox/unprocessed",
              mimeType: "application/json",
              text: JSON.stringify({ error: error.message }),
            },
          ],
        }
      }

      return {
        contents: [
          {
            uri: "brain://inbox/unprocessed",
            mimeType: "application/json",
            text: JSON.stringify({ items: data ?? [] }, null, 2),
          },
        ],
      }
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
