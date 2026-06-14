# OpenClaw + Suganuma Ops Hub (MCP remoto)

Conecte seu gateway OpenClaw ao Ops Hub via **MCP Streamable HTTP**.

## 1. Gerar token no Ops Hub

1. Abra `https://ops.suganuma.com.br/settings`
2. Vá em **Agent Tokens**
3. Clique em **Gerar token**
4. Copie o token (começa com `ops_`)

## 2. Adicionar servidor MCP no OpenClaw

No arquivo `~/.openclaw/openclaw.json`, adicione dentro de `mcp.servers`:

```json5
{
  mcp: {
    servers: {
      "ops-hub": {
        url: "https://ops.suganuma.com.br/api/mcp",
        transport: "streamable-http",
        timeout: 30,
        connectTimeout: 10,
        supportsParallelToolCalls: true,
        headers: {
          Authorization: "Bearer ops_SEU_TOKEN_AQUI"
        }
      }
    }
  }
}
```

## 3. Verificar conexão

```bash
openclaw mcp doctor ops-hub --probe
openclaw mcp probe ops-hub --json
```

## 4. Skill do OpenClaw (recomendado)

Crie o arquivo `~/.openclaw/workspace/skills/ops-hub/SKILL.md`:

```markdown
---
name: ops-hub
description: Integracao com Suganuma Ops Hub para tasks, financas, saude, notas, refeicoes e habitos.
---

Quando o usuario pedir algo relacionado a tarefas, financas, saude, notas, refeicoes, habitos ou dashboard pessoal, use as tools do servidor MCP `ops-hub`.

Regras:
- Para criar tarefa: use `tasks_create`. Extraia prioridade (urgent/high/med/low) e categoria (finance/logistics/personal/health) se mencionadas.
- Para listar tarefas pendentes: use `tasks_list` com status=todo.
- Para resumo financeiro: use `finance_summary` com mes no formato YYYY-MM.
- Para registrar medicao de saude: use `health_log_biometric`.
- Para consultas medicas: use `health_list_appointments`.
- Para notas: `notes_list`, `notes_create`, `notes_update`, `notes_delete`.
- Para refeicoes: `meals_list`, `meals_create`, `meals_get_plan`, `meals_set_plan`.
- Para habitos: `habits_list`, `habits_log_entry`.
- Para visao geral: use `dashboard_get`.
- Nunca execute tool de delecao sem confirmacao explicita do usuario.
```

## 5. Recarregar

```bash
openclaw mcp reload
```

## 6. Testar via chat

Mande uma mensagem pelo canal configurado (WhatsApp/Telegram/etc):

> "Crie uma task urgente: revisar contrato ate sexta"
> "Qual meu saldo de junho de 2026?"
> "Registra meu peso de hoje: 72.3kg"

## Troubleshooting

| Problema | Solucao |
|---|---|
| `403` no OPTIONS/Preflight | Verifique se `Origin` esta na allowlist do servidor (`MCP_ALLOWED_ORIGINS`) |
| `401` | Token invalido ou revogado; gere novo token em `/settings` |
| `400 Bad Request: no valid session ID` | Cliente MCP enviou requisicao fora de ordem; init deve vir primeiro |
| Tools nao aparecem | Rode `openclaw mcp probe ops-hub --json` e verifique se `tools > 0` |
| Timeout em tools longas | Aumente `timeout` no config para 60+ segundos |
