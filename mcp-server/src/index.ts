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
const MAX_RETRIES = Number(process.env.OPS_HUB_MAX_RETRIES ?? "5")
const BASE_DELAY_MS = 1000

if (!TOKEN) {
  process.stderr.write("ERROR: OPS_HUB_TOKEN env var is required\n")
  process.exit(1)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function connectWithRetry(): Promise<Client> {
  const url = new URL("/api/mcp", BASE_URL)

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const transport = new StreamableHTTPClientTransport(url, {
        requestInit: {
          headers: {
            Authorization: `Bearer ${TOKEN}`,
            Origin: "https://ops.suganuma.com.br",
          },
        },
      })

      const client = new Client(
        { name: "ops-hub-stdio-proxy", version: "0.3.1" },
        { capabilities: {} }
      )

      await client.connect(transport)
      process.stderr.write(`ops-hub stdio proxy connected (attempt ${attempt})\n`)
      return client
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1)
      process.stderr.write(`Connect attempt ${attempt}/${MAX_RETRIES} failed: ${lastError.message}; retrying in ${delay}ms\n`)
      if (attempt < MAX_RETRIES) {
        await sleep(delay)
      }
    }
  }

  throw lastError ?? new Error("Failed to connect after retries")
}

async function main() {
  let client = await connectWithRetry()
  let cachedTools: Tool[] | undefined

  const server = new Server(
    { name: "ops-hub", version: "0.3.1" },
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
      // If the error suggests the connection was lost, attempt a reconnect
      const errMsg = err instanceof Error ? err.message : String(err)
      if (errMsg.includes("disconnect") || errMsg.includes("closed") || errMsg.includes("transport")) {
        process.stderr.write(`Connection lost during tool call '${name}': ${errMsg}; attempting reconnect...\n`)
        try {
          client = await connectWithRetry()
          cachedTools = undefined
          const result = await client.callTool({ name, arguments: args ?? {} })
          return result
        } catch (reconnectErr) {
          process.stderr.write(`Reconnect failed: ${reconnectErr instanceof Error ? reconnectErr.message : String(reconnectErr)}\n`)
        }
      }
      return {
        content: [
          {
            type: "text",
            text: `Erro na tool ${name}: ${errMsg}`,
          },
        ],
        isError: true,
      }
    }
  })

  const stdio = new StdioServerTransport()
  await server.connect(stdio)

  process.stderr.write(`ops-hub stdio proxy ready\n`)
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err instanceof Error ? err.message : String(err)}\n`)
  process.exit(1)
})