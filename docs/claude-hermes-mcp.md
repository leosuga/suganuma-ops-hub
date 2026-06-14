# Claude Desktop / Hermes Agent — MCP stdio proxy

Use o `mcp-server` local como ponte entre clientes **stdio-only** (Claude Desktop, Hermes Agent, VS Code Insiders, etc.) e o endpoint remoto **Streamable HTTP** do Ops Hub.

## 1. Buildar o mcp-server

```bash
cd mcp-server
npm install
npm run build
```

O binário compilado fica em `mcp-server/dist/index.js`.

## 2. Configurar o Claude Desktop

Edite `~/.config/claude/claude_desktop_config.json` (macOS/Linux) ou `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "ops-hub": {
      "command": "node",
      "args": ["/caminho/absolute/para/mcp-server/dist/index.js"],
      "env": {
        "OPS_HUB_URL": "https://ops.suganuma.com.br",
        "OPS_HUB_TOKEN": "ops_..."
      }
    }
  }
}
```

> **Atenção:** use **caminho absoluto** em `args`. O Claude Desktop não expande `~` nem `$HOME`.

Reinicie o Claude Desktop. A lista de tools aparece no menu de ferramentas.

## 3. Configurar o Hermes Agent

No arquivo de configuração do Hermes (geralmente `~/.hermes/config.json` ou `~/.config/hermes/config.json`), adicione um servidor MCP stdio:

```json
{
  "mcpServers": {
    "ops-hub": {
      "type": "stdio",
      "command": "node",
      "args": ["/caminho/absolute/para/mcp-server/dist/index.js"],
      "env": {
        "OPS_HUB_URL": "https://ops.suganuma.com.br",
        "OPS_HUB_TOKEN": "ops_..."
      }
    }
  }
}
```

Reinicie o Hermes Agent.

## 4. Configurar VS Code / VS Code Insiders

Em `.vscode/mcp.json` ou via settings (`ctrl+shift+p` → "MCP: Add Server"):

```json
{
  "servers": {
    "ops-hub": {
      "type": "stdio",
      "command": "node",
      "args": ["/caminho/absolute/para/mcp-server/dist/index.js"],
      "env": {
        "OPS_HUB_URL": "https://ops.suganuma.com.br",
        "OPS_HUB_TOKEN": "ops_..."
      }
    }
  }
}
```

## 5. Testar o stdio proxy manualmente

```bash
export OPS_HUB_URL="https://ops.suganuma.com.br"
export OPS_HUB_TOKEN="ops_..."
printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}}}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
| node mcp-server/dist/index.js
```

Você deve ver:

```
ops-hub stdio proxy connected to https://ops.suganuma.com.br/api/mcp
{"result":{"protocolVersion":"2024-11-05","capabilities":{"tools":{}},"serverInfo":{"name":"ops-hub","version":"0.3.0"}},"jsonrpc":"2.0","id":1}
{"result":{"tools":[...]},"jsonrpc":"2.0","id":2}
```

## 6. Troubleshooting

| Problema | Solucao |
|---|---|
| `ERROR: OPS_HUB_TOKEN env var is required` | Token nao foi passado no `env` do client |
| `Unauthorized` / `401` | Token invalido ou revogado; gere um novo em `/settings` |
| `Transport error` / timeout | Verifique conectividade com `https://ops.suganuma.com.br/api/mcp` |
| Tools nao aparecem no Claude | Reinicie o app; verifique se o caminho em `args` e absoluto |
| Cliente nao suporta Streamable HTTP | Use obrigatoriamente este stdio proxy — nao conecte direto no `/api/mcp` |

## 7. Como funciona o proxy

O `mcp-server` local é muito fino:

1. Le `OPS_HUB_URL` + `OPS_HUB_TOKEN`
2. Cria um `Client` MCP usando `StreamableHTTPClientTransport`
3. Conecta ao remoto `/api/mcp`
4. Expoe um `Server` MCP local via `StdioServerTransport`
5. Repassa `tools/list` e `tools/call` para o servidor remoto

Isso elimina duplicacao: todas as 35 tools, schemas e auth ficam centralizados no Ops Hub.
