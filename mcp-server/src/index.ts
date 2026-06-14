#!/usr/bin/env node
/**
 * MCP server stdio proxy para Suganuma Ops Hub.
 * Conecta a um servidor MCP remoto Streamable HTTP e expoe as mesmas tools via stdio.
 *
 * Requer variaveis de ambiente:
 *   OPS_HUB_URL   — ex: https://ops.suganuma.com.br
 *   OPS_HUB_TOKEN — token gerado em /settings (prefixo ops_)
 *
 * Uso no Claude Desktop (~/.config/claude/claude_desktop_config.json):
 * {
 *   "mcpServers": {
 *     "ops-hub": {
 *       "command": "node",
 *       "args": ["/caminho/para/mcp-server/dist/index.js"],
 *       "env": {
 *         "OPS_HUB_URL": "https://ops.suganuma.com.br",
 *         "OPS_HUB_TOKEN": "ops_..."
 *       }
 *     }
 *   }
 * }
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js"

const BASE_URL = process.env.OPS_HUB_URL ?? "https://ops.suganuma.com.br"
const TOKEN = process.env.OPS_HUB_TOKEN ?? ""

if (!TOKEN) {
  process.stderr.write("ERROR: OPS_HUB_TOKEN env var is required\n")
  process.exit(1)
}

async function main() {
  const url = new URL("/api/mcp", BASE_URL)

  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        Origin: "https://ops.suganuma.com.br",
      },
    },
  })

  const client = new Client(
    { name: "ops-hub-stdio-proxy", version: "0.3.0" },
    { capabilities: {} }
  )

  await client.connect(transport)

  // Cache tools to avoid repeated remote calls for listTools
  let cachedTools: Tool[] | undefined

  const server = new Server(
    { name: "ops-hub", version: "0.3.0" },
    { capabilities: { tools: {} } }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    if (!cachedTools) {
      const res = await client.listTools()
      cachedTools = res.tools
    }
    return { tools: cachedTools }
  })

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params
    try {
      const result = await client.callTool({ name, arguments: args ?? {} })
      return result
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Erro na tool ${name}: ${err instanceof Error ? err.message : String(err)}`,
          },
        ],
        isError: true,
      }
    }
  })

  const stdio = new StdioServerTransport()
  await server.connect(stdio)

  process.stderr.write(`ops-hub stdio proxy connected to ${url.toString()}\n`)
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})
