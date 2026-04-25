# Suganuma Ops Hub — MCP Server

Servidor MCP com transporte stdio para integração com Claude Desktop, Hermes Agent e OpenClaw.

## Setup rápido

```bash
cd mcp-server
npm install
npm run build
```

## Variáveis de ambiente

| Var | Descrição |
|-----|-----------|
| `OPS_HUB_URL` | URL base do app, ex: `https://ops.suganuma.com.br` |
| `OPS_HUB_TOKEN` | Token gerado em Settings → Agent Tokens (prefixo `ops_`) |

## Claude Desktop

Adicione ao `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ops-hub": {
      "command": "node",
      "args": ["/caminho/absoluto/mcp-server/dist/index.js"],
      "env": {
        "OPS_HUB_URL": "https://ops.suganuma.com.br",
        "OPS_HUB_TOKEN": "ops_..."
      }
    }
  }
}
```

## Hermes Agent / OpenClaw

Use o binary compilado como skill stdio. Exemplo de invocação:

```bash
OPS_HUB_URL=https://ops.suganuma.com.br \
OPS_HUB_TOKEN=ops_... \
node dist/index.js
```

## Tools disponíveis

| Tool | Descrição |
|------|-----------|
| `tasks_list` | Lista tasks com filtro por status/priority |
| `tasks_create` | Cria uma task |
| `tasks_update` | Atualiza campos de uma task |
| `tasks_complete` | Marca como concluída |
| `finance_summary` | KPIs do mês (receita, despesas, saldo) |
| `finance_add_transaction` | Registra transação |
| `health_log_biometric` | Registra medição biométrica |
| `health_biometrics` | Consulta histórico de medições |
| `health_create_appointment` | Agenda consulta |
| `dashboard_get` | Snapshot consolidado cross-domain |

## Exemplos de uso no Claude

> "Crie uma task urgente: revisar contrato com o cliente até sexta"

> "Qual é meu saldo de maio de 2026?"

> "Registra meu peso de hoje: 72.3kg"

> "Quais são minhas próximas consultas?"
