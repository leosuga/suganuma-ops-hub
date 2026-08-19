# Conectar o Ops Hub ao claude.ai (OAuth)

O endpoint `/api/mcp` agora é um recurso protegido por OAuth 2.1, o que permite
adicioná-lo como **custom connector** no claude.ai — sem token estático, sem
depender do desktop, e funcionando também nas tarefas agendadas.

Os tokens de agente (`ops_...`) continuam válidos: o stdio proxy e os scripts
existentes não precisam de mudança nenhuma.

## O que foi implementado

| Peça | Onde |
|---|---|
| Protected Resource Metadata (RFC 9728) | `/.well-known/oauth-protected-resource[/api/mcp]` |
| Authorization Server Metadata (RFC 8414) | `/.well-known/oauth-authorization-server` |
| Tela de consentimento | `/authorize` |
| Token endpoint (code + refresh) | `/api/oauth/token` |
| Dynamic Client Registration (fallback) | `/api/oauth/register` |
| Tabelas | migration `0035_oauth.sql` |

Fluxo: `authorization_code` + **PKCE S256 obrigatório**, cliente público
(sem `client_secret`), identificado por **CIMD** (Client ID Metadata Document) —
sem banco de clientes. DCR existe só como fallback para clientes que não falam CIMD.

Access token: 1h. Refresh token: 60 dias, **rotacionado a cada uso** (exigência
para clientes públicos). Nenhum segredo é gravado em claro — só o SHA-256.

## Passos para ativar

### 1. Rodar a migration

No SQL editor do Supabase, executar `supabase/migrations/0035_oauth.sql`.
(Migrations neste projeto são aplicadas manualmente — ver AGENTS.md.)

Sem a migration, o código não quebra nada: os endpoints OAuth retornam erro e os
tokens `ops_` continuam funcionando normalmente.

### 2. Conferir a env var do issuer

O issuer precisa bater exatamente com a URL que o Claude usa. O default já é
`https://ops.suganuma.com.br`; para sobrescrever, defina `OAUTH_ISSUER` no
`.env.prod` (via GitHub Secrets + deploy).

TTLs opcionais: `OAUTH_ACCESS_TOKEN_TTL` (padrão 3600) e
`OAUTH_REFRESH_TOKEN_TTL` (padrão 5184000).

### 3. Deploy

Pipeline normal. Depois, validar os três endpoints:

```bash
curl -s https://ops.suganuma.com.br/.well-known/oauth-protected-resource/api/mcp | jq
curl -s https://ops.suganuma.com.br/.well-known/oauth-authorization-server | jq

# Deve responder 401 COM o header WWW-Authenticate:
curl -si -X POST https://ops.suganuma.com.br/api/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  | grep -i www-authenticate
```

O header `WWW-Authenticate` é a peça central: é ele que faz o Claude descobrir o
authorization server. Sem ele (ou com um 200 no lugar do 401), o claude.ai mostra
erro de conexão em vez do botão de conectar.

### 4. Adicionar no claude.ai

Customize → Connectors → Add custom connector → URL:

```
https://ops.suganuma.com.br/api/mcp
```

Deixe os campos de OAuth Client ID/Secret **vazios** — o servidor usa CIMD, que
dispensa registro. O Claude abre a tela de consentimento; estando logado no hub,
é só aprovar. Se não estiver logado, o fluxo passa pelo magic link e volta
automaticamente para a autorização.

## Escopos

| Escopo | Efeito |
|---|---|
| `ops:read` | Rotas `GET` da API de agente |
| `ops:write` | Rotas `POST`/`PATCH`/`DELETE` |
| `offline_access` | Emite refresh token |

A checagem é feita em `validateAgentToken`, por método HTTP — vale para as 25
rotas `/api/agent/*` de uma vez, inclusive quando chamadas pelas tools MCP.

## Limpeza

`prune_oauth_artifacts()` (definida na migration) apaga codes expirados e
tokens revogados/expirados há mais de 30 dias. Não há `pg_cron` garantido no
projeto, então ela não roda sozinha — chamar sob demanda no SQL editor:

```sql
select prune_oauth_artifacts();
```

## Revogar acesso

`update oauth_token set revoked_at = now() where owner_id = '<uuid>';`

A revogação tem efeito imediato: cada requisição MCP revalida o portador (não só
o `initialize`), então uma sessão aberta para de funcionar na próxima chamada.

## Notas de implementação

- **Consentimento via fetch, não via `<form>`**: a CSP do app define
  `form-action 'self'`, e navegadores aplicam isso também ao redirect que segue
  um POST de formulário — o que bloquearia a volta para `claude.ai`. Uma
  navegação iniciada por script não passa por essa diretiva.
- **Nome exibido no consentimento é o host do `client_id`**, nunca o
  `client_name` do documento: o documento é auto-declarado e um `client_name`
  livre permitiria spoofing.
- **`redirect_uri` de loopback compara ignorando a porta** (RFC 8252 §7.3),
  porque clientes nativos escolhem porta efêmera em runtime.
- **Discovery precisa ser público**: `/.well-known/*` está no `BYPASS` do
  middleware. Se cair no redirect de login, a conexão falha com
  "couldn't reach the MCP server".
- Os handlers vivem em `/api/oauth/metadata/*` e chegam em `/.well-known/*` por
  rewrite no `next.config.ts` — o App Router não roteia diretórios iniciados
  por ponto.
