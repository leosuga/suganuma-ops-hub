# Integrações: rede externa, Qdrant, webhooks, Web Push, Raindrop, Embeddings, MCP, Inbox, Ollama, Search

Movido do AGENTS.md para reduzir contexto carregado por sessão. Leia sob demanda.

## Rede externa — padrão de timeout (2026-08-29)
- **`fetchWithTimeout(url, init, timeoutMs)`** (`src/lib/fetch-with-timeout.ts`): AbortController + clearTimeout em `finally`. Usar em TODA fetch externa nova
- Timeouts aplicados: Ollama chat/embed 120s (`OLLAMA_TIMEOUT_MS`), Ollama health 5s, Qdrant 10s (`QDRANT_TIMEOUT_MS`), Raindrop 30s (`RAINDROP_TIMEOUT_MS`), CIMD 5s, MCP interno 30s
- Sem timeout, request pendurado (ex: ollama.com lento) trava server action/sync indefinidamente
- **Erros server-side mascarados ao cliente**: `serverError()` em `agent-auth.ts` loga detalhe com correlation id UUID e devolve só `Erro interno (ref: <uuid>)` — não vazar mensagens do Supabase
- **Sessões MCP** têm TTL 24h (`MCP_SESSION_TTL_MS`) com eviction no setInterval de 5min
- **`/api/oauth/register` (DCR)** tem rate limit 10/min por IP (`checkOAuthRegisterRateLimit`)

## Qdrant — auth e rede (descobertas 2026-08-29)
- **Qdrant exige API key**: container roda com `QDRANT__SERVICE__API_KEY` definido. Toda chamada sem o header `api-key` recebe **401 silencioso** — e foi assim desde sempre: `qdrant.ts` nunca enviou o header, então sync de embeddings/busca vetorial caíam 401 e a busca "funcionava" só pelo fallback FTS. Fix: `QDRANT_API_KEY` env + header em todas as chamadas (`qdrantHeaders()` em `qdrant.ts`, `RECONCILE_AUTH_HEADERS` no reconcile)
- **Qdrant vive na rede `rede_data`** (NÃO `coolify`): DNS Docker não cruza redes. O deploy conecta o container da app às duas: `coolify` (Caddy/Supabase/Ollama) + `rede_data` (Qdrant). Sem o connect manual, `wget qdrant:6333` → `bad address`
- **Secret extraído sem exposição**: para copiar um secret do VPS ao GitHub sem exibi-lo no terminal: `ssh LeoVM 'docker inspect qdrant --format "{{json .Config.Env}}"' | python3 -c "..." | gh secret set NOME` — pipe direto VPS→GitHub
- **Coleção `ops_hub_notes` nasce vazia**: scroll com 404 = coleção inexistente (primeira run) → tratado como mapa vazio, todas as notes viram "missing" e re-embed gradual (cap 50/run por padrão). Para acelerar: rodar o workflow manualmente ou subir `RECONCILE_MAX_RE_EMBEDS`
- **Healthcheck rápido do Qdrant**: `docker exec suganuma-ops-hub wget -qO- http://qdrant:6333/healthz` (após network connect)


## Webhooks (2026-06-19, atualizado 2026-08-29)
- **3 webhooks**: `email-to-task`, `csv-from-bank`, `deploy-status` — cada um com secret DEDICADO (`EMAIL_SECRET`/`CSV_SECRET`/`DEPLOY_SECRET`), fallback para `WEBHOOK_SECRET` compartilhado (compatível até os secrets serem criados no GitHub)
- HMAC centralizado em `src/lib/webhooks/hmac.ts` com `crypto.timingSafeEqual` (constant-time comparison) — **coberto por 16 testes** (`tests/webhooks-hmac.test.ts`)
- **Idempotência**: tabela `webhook_event` com unique constraint `(source, event_key)`. Cada webhook verifica replay antes de processar
- **Payload schemas**: `email-to-task` aceita `message_id`, `csv-from-bank` aceita `import_id`, `deploy-status` aceita `run_id` para event keys explícitos

## Web Push (VAPID) (2026-08-29)
- **Notificações com o app FECHADO** — diferente de `new Notification()` (exige aba aberta). iOS 16.4+ PWA instalada suporta; Chrome/Firefox sempre suportaram
- **Migration 0039** `push_subscription`: endpoint unique (re-subscribe = upsert), RLS — usuário gerencia só as próprias
- **Server**: `src/lib/web-push.ts` com `web-push` lib; TTL 1h; subs inválidas (410/404) auto-removidas após envio; `WEB_PUSH_VAPID_PUBLIC_KEY`/`WEB_PUSH_VAPID_PRIVATE_KEY`
- **Rotas**: `GET /api/push` (public key), `POST/DELETE /api/push` (subscribe/unsubscribe via sessão + RLS), `POST /api/push/send` (HMAC com `WEBHOOK_SECRET`; monta briefing automático de overdue tasks + consultas 24h se payload vazio)
- **Client**: `src/lib/use-web-push.ts` — **requestPermission só via GESTO** (botão em Settings; iOS PWA bloqueia sem gesto). `urlB64ToUint8Array` converte a VAPID key
- **SW v18**: handler `push` (mostra notificação) + `notificationclick` (foca/navega p/ `data.url`)
- **UI**: Settings → seção "NOTIFICAÇÕES PUSH" com estados unsupported/unconfigured/default/granted/denied
- **Cron**: workflow "Daily Briefing Push" — 11:00 UTC (08:00 BRT) → 1 run do briefing; falha real (não-200) aborta
- **iOS**: exigiu PWA reinstalada? Não — mas exige PWA **instalada** (standalone), não Safari tab. Se o toggle aparece "não suportado": verificar se foi aberto da home screen
- **Gerar novas chaves**: `npx web-push generate-vapid-keys` → `gh secret set WEB_PUSH_VAPID_*` + linhas no `.env.prod` do VPS + deploy

## Raindrop Sync (2026-08-27)
- **Endpoint**: `POST /api/integrations/raindrop-sync` — ponte de curadoria automática Raindrop → Hub Notes (Variante C)
- **Auth**: HMAC com `RAINDROP_SYNC_SECRET` (secret DEDICADO, não reusa `WEBHOOK_SECRET`; `verifyWebhookHmac` agora aceita `secretOverride` como 3º parâmetro)
- **Fluxo**: cron semanal (GitHub Actions, segunda 11:00 UTC / 08:00 BRT) → lê cursor → busca raindrops das collections-alvo → dedup via `webhook_event` (`source='raindrop'`, key = raindrop `_id`) → classifica via LLM (`chatCompletion` Ollama Cloud, JSON mode) → roteia → avança cursor
- **Roteamento (Variante C)**: `reference` → nota via `createNoteWithEmbedding()` (tags: `raindrop` + slug da collection + tags do LLM, `para: "resources"`); `actionable` → `inbox_item` (source='raindrop', content prefixado com `[Collection]`)
- **Classificador**: viés para REFERENCE — artigos/tutoriais/guias/comparativos = nota; actionable só para ação concreta e próxima (testar ferramenta agora, inscrição, vaga). Empírico no backlog técnico: viés actionable → 56% no inbox (pilha movida); recalibrado → 98 notas/2 inbox
- **Multi-collection**: `RAINDROP_COLLECTION_IDS` (CSV com 16 IDs). Fetch por collection INDIVIDUAL (`listAllRaindropsSince` faz loop) — NÃO usar `collectionId=0` (todas): collections pessoais grandes (ex: "unread", ~3.8k itens) afogam o backlog técnico no fetch das páginas mais recentes
- **Raindrop API** (validada 2026-08-27): Test Token NÃO expira; `perpage` máx 50; `page` 0-based; filtro nativo de data via `search=created:>YYYY-MM-DD` (granularidade de DIA — borda resolvida com cursor−1 dia + filtro client-side por timestamp + dedup); cada raindrop traz `collection.$id`; `type` nativo (`article`/`link`/`video`/`document`/`image`/`audio` — image/audio pulados); permanent copy (`/cache`) é Pro-only
- **Cursor**: nota pinned com tag `raindrop-sync-state` (corpo = ISO timestamp do último `created` processado). Zero migration. Parsing defensivo (falha → null → refetch, dedup protege). **Write com guard otimista** (2026-08-29): `update().eq("content", cursorLido)` — sweep concorrente com o cron não regrediu o cursor
- **Nota criada fora da UI entra no índice vetorial**: helper compartilhado `createNoteWithEmbedding()` (`src/lib/actions/notes.ts`) — insert service role + `syncNoteEmbeddingForOwner` fire-and-forget. Usado por `/api/agent/notes` POST e pelo Raindrop sync
- **Workflow**: `.github/workflows/raindrop-sync.yml` — cron `0 11 * * 1` + `workflow_dispatch`; assina HMAC do body `{}` com `openssl dgst -sha256 -hmac`
- **Backlog sweep**: `scripts/raindrop-sweep.sh` — loop de `workflow_dispatch` até delta < 100 (backlog esgotado); log em `/tmp/raindrop-sweep.log`
- **Cap por run**: `RAINDROP_MAX_ITEMS_PER_RUN` (default 50, código e deploy.yml) — protege contra runaway de chamadas LLM; cursor avança oldest-first (sort client-side crescente) para nunca perder itens no cap
- **Classificação em lote**: 1 chamada LLM por chunk de 20 itens (amortiza o system prompt; ~20× menos chamadas/latência vs 1 por item). 1 retry por chunk em falha; item sem classificação válida → fallback (reference, sem resumo). Mapeamento por `index` explícito com fallback posicional. Response/log incluem `llm_calls`
- **Docs**: `docs/raindrop-hub-bridge.md`

## Embeddings Reconcile (2026-08-29)
- **Problema que resolve**: `syncNoteEmbedding` fire-and-forget no `onSettled` — se falhar, a nota fica fora do índice vetorial **para sempre** (busca semântica nunca a encontra; fallback FTS mitiga mas não corrige)
- **Endpoint**: `POST /api/integrations/embeddings-reconcile` — HMAC com `EMBEDDINGS_RECONCILE_SECRET` (secret dedicado)
- **Algoritmo**: scroll paginado do Qdrant (payload traz `content_hash` do texto embedado) × varredura paginada de notes → re-embed SÓ do que diverge ou não existe
- **`contentHash`** (`src/lib/content-hash.ts`): SHA-256 truncado a 32 hex do `embeddableText` — função compartilhada define a concatenação canônica (`title\n\ncontent`) em UM lugar. Coberta por testes (`tests/content-hash.test.ts`)
- **Caps**: `RECONCILE_MAX_RE_EMBEDS` (50/run) + delay 250ms entre embeds (`RECONCILE_EMBED_DELAY_MS`) — não satura Ollama local
- **Órfãos** (Qdrant aponta nota deletada): apenas reportados (`orphanCount`), não deletados — risco baixo
- **Trigger**: workflow "Embeddings Reconcile" (domingo 06:00 UTC + `workflow_dispatch`) — pulado silenciosamente se `EMBEDDINGS_RECONCILE_SECRET` não existir
- **Secrets/CI**: `actions/checkout` e `actions/setup-node` migrados para @v7 (2026-08-29; @v4 rodava Node 20 deprecado)

## MCP Server (2026-06-19)
- **Endpoint**: `/api/mcp` (Streamable HTTP, spec 2025-06-18)
- **Auth**: Bearer token (`ops_...`) validado contra `agent_token` table
- **38 tools**: tasks, finance, health, notes, meals, habits, projects, budget, calendar, reports, dashboard, semantic search, **inbox (capture_thought, inbox_list)**, **get_daily_cockpit**
- **Resources** (2026-08-10): `brain://active_projects` e `brain://inbox/unprocessed` — contexto read-only para AI clients (Claude Desktop). Scoped por `ctx.ownerId`
- **Rate limiting**: 120 req/min por IP (namespace `mcp`), bloqueio 60s. Cleanup automático a cada 5min via `setInterval`
- **Agent API rate limiting**: 60 req/min por IP (namespace `agent`) aplicado via `middleware.ts` em `/api/agent/*` (25 rotas)
- **Audit log**: tabela `mcp_audit_log` registra toda tool call com `tool_name`, `success`, `duration_ms`, `args`
- **API timeout**: `agentApi` usa `AbortController` com 30s timeout (`MCP_API_TIMEOUT_MS` env override)
- **Input validation**: rotas agent validam query params (`parseMonthParam`, `validateIsoDateTime`, `validateHealthKind`, `parseLimitParam`) e path params (`validateUuidParam`) via helpers em `agent-auth.ts`
- **stdio proxy** (`mcp-server/src/index.ts`): conecta ao remote `/api/mcp` via StreamableHTTP, expõe tools via stdio. Reconexao exponencial (5 retries) + retry em tool calls com erro de transporte
- **Type safety**: schemas Zod passados direto ao `registerTool` (SDK suporta Zod v3/v4 nativamente via `zod-json-schema-compat`)
- **Docs**: `docs/openclaw-mcp.md` (remote HTTP), `docs/claude-hermes-mcp.md` (stdio proxy)

## Inbox & Auto-Triage (2026-08-09)
- **Tabela `inbox_item`** (migration 0032): content, source (manual/telegram/audio/email/webhook/mcp), ai_payload (jsonb), status (unprocessed/triaged/archived), triaged_at. RLS + realtime
- **Captura de atrito zero**: UI `/inbox` (Omni-Capture Bar) + MCP `capture_thought` + Agent API `POST /api/agent/inbox`
- **LLM Auto-Triage** (`src/lib/actions/inbox-triage.ts`): server action que chama Ollama Cloud (`gpt-oss:20b`) com JSON mode. Extrai: tipo (task/note/idea/reminder/multiple), categoria, prioridade, tags, action_items (quebra pensamentos vagos em ações físicas), summary. Salva em `ai_payload`
- **Detecção de duplicatas**: embed do conteúdo → Qdrant search (threshold 0.75) → lista notas similares no `ai_payload.duplicates`
- **Batch triage**: `triageAllPending()` processa até 20 items sem `ai_payload`. Botão "TRIAR TUDO" na UI
- **Conversão**: 1 toque → TASK (usa action_items[0] + categoria/prioridade/tags sugeridas) ou NOTE (usa summary + tags). Teclado: J/K navegar, T task, N note, I triar IA, A arquivar
- **Daily Cockpit**: página `/cockpit` (UI) + `GET /api/agent/inbox/cockpit` (API) + MCP `get_daily_cockpit` (tool). Briefing: inbox pendente, urgentes, atrasadas, quick wins, consultas, eventos

## Ollama — Embeddings local + Chat Cloud (2026-08-10)
- **Embeddings**: `nomic-embed-text` no Ollama local do VPS (768-dim). Usado por Qdrant sync, busca semântica, detecção de duplicatas. Latência baixa, privado, zero custo
- **Chat**: Ollama Cloud (`https://ollama.com`) com `OLLAMA_API_KEY` (Bearer). Modelo `gpt-oss:20b` (default, `OLLAMA_CHAT_MODEL`). Usado pela auto-triage
- **Fallback**: se `OLLAMA_API_KEY` não estiver setada ou cloud falhar, `chatCompletion()` cai para o Ollama local (`llama3.2`). Nada quebra
- **Env vars**: `OLLAMA_URL` (local), `OLLAMA_CLOUD_URL`, `OLLAMA_API_KEY`, `OLLAMA_CHAT_MODEL` — todas no deploy.yml

## Semantic Search — Hybrid RAG (2026-08-10)
- **Migration 0033**: `search_vector` tsvector + GIN index + triggers em `note` e `task` (title weight A, content weight B, config `portuguese`)
- **`hybridSearchNotes()`** (`src/lib/actions/hybrid-search.ts`): combina Qdrant vector (threshold 0.5) + PostgreSQL FTS (`textSearch`) com **Reciprocal Rank Fusion** (k=60). Resultados em ambas as fontes sobem no ranking
- **source**: `vector` | `fts` | `hybrid` — badge na UI (SemanticSearchPanel)
- **Fallbacks**: se Qdrant falhar → só FTS; se FTS falhar → só vector. Nunca quebra
- **MCP**: `notes_search_semantic` usa hybrid search

