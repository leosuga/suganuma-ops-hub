<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Stack — versões exatas (não assuma defaults de treino)
- Next.js **16.2.6** | React **19.2.6** | Zod **4.3.6** | Tailwind **v4**
- UI primitives: `@base-ui/react` (Dialog, Checkbox, Button) — **NÃO é Radix UI**
- Tokens CSS: `--color-bg`, `--color-surface`, `--color-teal`, `--color-amber`, `--color-danger`, `--color-health`, `--color-on-surface` via `@theme inline` no globals.css
- Tema customizável: `--color-accent` / `--color-accent-hi` (5 opções: teal, blue, green, purple, orange) via `src/lib/theme.ts`

## Regras de código
- Sempre usar `cn()` de `@/lib/utils` para classes condicionais
- Dialog: `open` (boolean) + `onOpenChange={(v) => setState(v)}`
- Checkbox: prop `checked` (boolean) + `onCheckedChange`
- Campos de DB (`owner_id`, `completed_at`, `created_at`) NÃO estão no Zod schema — adicionar no tipo da mutation quando necessário
- Server components podem usar `createClient()` de `@/lib/supabase/server` (async)
- Client components usam `createClient()` de `@/lib/supabase/client` (sync)
- Service role: `createServiceClient()` de `@/lib/supabase/service` (para webhooks e agent API, sem RLS)
- Logger: `logger.info(ctx, msg, data?)` / `logger.warn(...)` / `logger.error(...)` de `@/lib/logger`

## Arquitetura — padrões por domínio
Cada módulo segue este pipeline:
1. **Migration SQL** (`supabase/migrations/XXXX_nome.sql`) — DDL + RLS + índices + realtime
2. **Zod Schema** (`src/lib/schemas/nome.ts`) — validação, tipos exportados (`export type X = z.infer<...>`)
3. **Database Types** (`src/lib/database.types.ts`) — tipos Row/Insert/Update para o Supabase
4. **Queries TanStack** (`src/lib/queries/nome.ts`) — **exportar `queryOptions`** (ex: `tasksOptions`, `accountsOptions`) + hooks `useQuery`/`useMutation`. `queryOptions` facilita prefetch server-side e elimina duplicação de `queryKey`/`queryFn`
5. **Componentes** (`src/components/nome/`) — reutilizáveis, seguindo o design system do projeto
6. **Página** (`src/app/(app)/nome/page.tsx`) — server ou client component com `SectionErrorBoundary`
7. **Navegação** — adicionar em: Sidebar, BottomNav (mobile, máx 5 itens), TopBar, CommandPalette

## Domínios

| Módulo | Rota | Migration | Queries | Página | Testes |
|---|---|---|---|---|---|
| Dashboard | `/dashboard` | — | tasks+finance+health+meals+notes+projects+budget | `dashboard/page.tsx` | — |
| Tasks | `/tasks` | 0001 | `tasks.ts` | `tasks/page.tsx` | 7 |
| Finance | `/finance` | 0002 | `finance.ts` | `finance/page.tsx` | 6 |
| Health | `/health` | 0003 | `health.ts` | `health/page.tsx` | 13 |
| Calendar | `/calendar` | — | `calendar.ts` | `calendar/page.tsx` | — |
| Notes | `/notes` | 0007 | `notes.ts` | `notes/page.tsx` | 5 |
| Meals | `/meals` | 0008 | `meals.ts` | `meals/page.tsx` | 5 |
| Habits | `/habits` | 0009 | `habits.ts` | `habits/page.tsx` | 8 |
| Projects | `/projects` | 0010 | `projects.ts` | `projects/page.tsx` | — |
| Budget | (dashboard) | 0016 | `budget.ts` | (BudgetCard no Dashboard) | — |
| Reports | `/reports` | — | `reports.ts` | `reports/page.tsx` | — |
| Settings | `/settings` | — | — | `settings/page.tsx` | — |
| Shared | — | — | `parse-title.ts`, `contexts.ts` | — | 24 |

Schemas testados: `tests/schemas.test.ts` (38 testes Zod)

## Features e comportamentos

### Tasks
- **Parser `parseTitle()`** (`src/lib/parse-title.ts`): usado por QuickAddDialog, QuickAddTask do Dashboard, e demais entradas de task. Suporta:
  - `>NomeProjeto` — busca por nome exato nos projetos existentes (case-insensitive, longest match first)
  - `#finance|logistics|personal|health` — categoria fixa
  - `#palavra` — tags livres (coluna `tags text[]`). Palavras após `#` que NÃO são categorias reservadas viram tags
  - `!urgent|high|med|low` — prioridade
  - `^today|tomorrow|YYYY-MM-DD` — data de vencimento
  - `@Nome` — delegação (campo `delegated_to`)
  - `+importante` — toggle boolean `important` (Eisenhower)
  - `*diario|*semanal|*mensal` — recorrência (coluna `recurrence`)
  - `~low|med|high` — energia necessária (coluna `energy_level`). `~high` = deep work, `~low` = quick win
- **Recorrência** (`0014_recurrence.sql`): ao concluir task com `recurrence`, o sistema auto-cria a próxima task (due_at = +1d/+7d/+1m). A nova task herda: título, categoria, prioridade, projeto, delegado, importante, tags
- **Tags** (`0015_tags.sql`): coluna `tags text[]` na task. Exibidas como pills `#tag` no TaskRow. Filtro por tag na TasksPage
- **Energy level** (`0034_task_energy_level.sql`): coluna `energy_level` (low/med/high). Badge no TaskRow: DEEP (high/purple), MED (med/neutral), QUICK (low/teal). EditTaskDialog tem seletor toggle
- **Notas vinculadas**: tasks podem ter notas vinculadas (`linked_task_id` em note, FK com `on delete set null`). EditTaskDialog mostra lista de notas vinculadas
- **Matriz de Eisenhower**: Dashboard exibe quadrantes (Urg+Imp / Imp+NãoUrg / Urg+NãoImp / NemUrgNemImp) filtrados por `important` e `priority`/`due_at`

### Notes
- **Converter nota em task**: botão `→TASK` no NoteRow (modo leitura). Cria task com título+conteúdo da nota e vincula automaticamente via `linked_task_id`

### Projects
- **Templates** (`src/lib/templates.ts`): 5 templates hardcoded — Reforma, Servidor, Estudos, Freelance, Evento. Cada template define nome, cor, descrição e lista de tasks. Ao selecionar um template no CreateProjectDialog, o projeto é criado com as tasks automaticamente inseridas
- **Progresso**: barra de progresso calculada a partir das tasks vinculadas (`done/total`)

### Export/Import
- **Export**: `exportAllData()` exporta 15 tabelas como JSON. Download via Blob
- **Import total**: `importAllData(json)` insere todas as tabelas
- **Import seletivo** (`SelectiveImportDialog`): UI que lista tabelas do arquivo JSON, permite selecionar quais importar, mostra contagem de linhas por tabela

## Componentes compartilhados
- **`SectionErrorBoundary`** (`src/components/SectionErrorBoundary.tsx`) — class component com retry, envolve todas as páginas
- **`UndoToast`** (`src/components/UndoToast.tsx`) — provider global no AppShell, toast com botão DESFAZER (5s timeout). Todos os deletes (task, transaction, note, meal, habit) disparam `toast.show()` com snapshot para `onUndo`
- **`VirtualizedList`** (`src/components/VirtualizedList.tsx`) — wrapper `@tanstack/react-virtual`, ativa com >50 itens. TasksPage e TransactionTable já usam
- **`CommandPalette`** (`src/components/shell/CommandPalette.tsx`) — `Cmd+K` global, navegação + busca de tasks/transações/appointments do cache
- **`NoteRow`** (`src/components/notes/NoteRow.tsx`) — envolvido em `React.memo()`. Computações pesadas (frontmatter, wiki links, backlinks, markdown, inline tasks, context tags) memoizadas com `useMemo`

## Mock do Supabase nos testes
Usar `vi.mock("@/lib/supabase/client")` + `vi.mock("@/lib/realtime")` antes dos imports.
Criar função `chain(value, error?)` que retorna Proxy com todas as props retornando nova Proxy (chain fluente: `.from().select().eq().order().limit()`).
Quando `prop === "then"`, resolve/rejeita a Promise.
Exemplo: `MockClient.mockReturnValue({ from: () => chain([data]), auth: authMock() })`.

## Notificações browser
- `useTaskNotifications()` (`src/lib/notifications.ts`) — verifica tasks atrasadas + consultas nas próximas 24h a cada 5min
- Dedup via localStorage (`ops_hub_notified_ts`)
- Realtime Postgres Changes em `task` table dispara re-check
- `requireInteraction: true` para não sumir automaticamente

## Export/Import (2026-06-19, hardening 2026-08-29)
- `exportAllData()` / `importAllData(json)` em `src/lib/export-import.ts`
- Exporta **17 tabelas**: task, project, account, transaction, health_log, pregnancy, appointment, protocol, protocol_entry, note, meal, meal_plan, habit_track, habit_entry, budget, annual_event, **inbox_item**
- **Export com paginação** (2026-08-29): `.range()` em páginas de 1000 — sem isso, self-hosted Supabase trunca tabelas >1000 rows **silenciosamente no único backup**
- **Import em chunks de 500** (2026-08-29): insert completo estourava body limit do PostgREST em tabelas grandes; erro por chunk logado, chunk seguinte tenta
- Import total: substitui `owner_id` pelo usuário atual, stripa `id`/`created_at`/`updated_at`, **stripa FKs cross-tabela** (`project_id`, `linked_task_id`, `account_id`, `meal_id`, `habit_id`, `protocol_id`, `pregnancy_id`, `series_id`) para evitar dangling references
- Import em ordem parent-first (`IMPORT_ORDER` exportado — reutilizado pelo diálogo seletivo)
- Export version: `0.3.0`
- **Import seletivo** (`src/components/settings/SelectiveImportDialog.tsx`): dialog que lista tabelas do JSON com contagem de linhas, permite selecionar quais importar — **sincronizado com importAllData** (mesmo `IMPORT_ORDER` parent-first + `FK_COLUMNS_TO_STRIP` + chunking + try/finally que não trava o `importing`)
- UI na página Settings com 3 botões: Exportar backup, Importar seletivo, Importar tudo

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

## Deploy

### Infraestrutura real no VPS
- **VPS**: acessível via SSH com `secrets.VPS_HOST`, `secrets.VPS_USER`, `secrets.VPS_SSH_KEY` (`144.22.194.71`, `ubuntu`, chave OneDrive/Chave_Leo)
- **Proxy**: **Caddy** gerencia todas as portas 80/443 no VPS — `suganuma.com.br`, `ops.suganuma.com.br`, `api.suganuma.com.br`, `coolify.suganuma.com.br`, etc. NÃO usar outro proxy (Traefik, Nginx) em paralelo
- **Coolify**: instalado e funcional (`coolify.suganuma.com.br:8081`). Docker socket montado via `docker-compose.custom.yml`. API token ativo (`8|...`). App `suganuma-ops-hub` registrada (`jgm57p9ild1iiriynleuatcz`)
  - Coolify serve para **gerenciar builds, env vars, deploys e rollbacks** da aplicação
  - O deploy via Coolify lança o container na rede Docker `coolify` (mesma rede do Caddy)
  - **Não é necessário migrar para Traefik** — o Caddy já gerencia todo o proxy do VPS
  - Caddy resolve o container do app via Docker DNS interno (`reverse_proxy suganuma-ops-hub:3000`)
  - Se Coolify renomear o container, atualizar o bloco `ops.suganuma.com.br` no Caddyfile
- **Container da app em produção**: nome `suganuma-ops-hub`, imagem `ops-hub:latest`, redes `coolify` (Caddy) + `rede_data` (Qdrant)

### update-ops-proxy.sh — NUNCA usar IP do container (lição 2026-08-29)
- O script `~/update-ops-proxy.sh` no VPS reescreve o bloco `ops.suganuma.com.br` do Caddyfile a cada deploy
- **Bug**: com o container multi-rede (coolify + rede_data), `{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}` retorna DOIS IPs e `head -1` os **concatena** → `reverse_proxy 10.0.2.2172.23.0.8:3000` → Caddy 502 em todo o domínio
- **Fix permanente no script**: upstream é SEMPRE o nome do container (`suganuma-ops-hub:3000`), sed substitui qualquer IP/hostname `:3000` pelo DNS. Reforça a lição de 2026-06-18 (container IP é dinâmico) e estende para multi-rede
- **Debug de "site down" pós-deploy**: 1) `docker exec caddy_proxy wget -qO- http://suganuma-ops-hub:3000/sw.js` (alcança?), 2) `grep -A3 ops.suganuma ~/proxy/Caddyfile` (upstream sadio?), 3) `docker logs caddy_proxy --tail 5`

### Dockerfile — regras críticas
- Base image: **`node:22-alpine`** (atualizado de v20 em 2026-05-09)
- `next build` precisa de `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` em tempo de build. Passar via `ARG` + `ENV` no stage `builder` e `--build-arg` no `docker build`
- `output: "standalone"` no next.config → copiar `.next/standalone` e `.next/static` no runner
- user `nextjs` (gid 1001)
- **HEALTHCHECK (2026-05-10)**: verifica `sw.js` via `node -e "http.get('http://127.0.0.1:3000/sw.js', ...)"` — start-period=40s para dar tempo do Next.js subir. Sem curl no Alpine minimal

### next.config.ts — Next.js 16.2.6
- ⚠️ A chave `eslint` **não existe** no tipo `NextConfig` do Next.js 16.2.6. Usá-la causa erro de type check no build (`Object literal may only specify known properties`). **NUNCA adicionar `eslint: { ignoreDuringBuilds: true }`**.
- `images: { unoptimized: true }` é necessário para standalone Docker (sem otimizador de imagem)
- `typescript: { ignoreBuildErrors: false }` mantém o type check habilitado (padrão implícito, mas explícito é melhor)

### tsconfig.json — regras críticas (2026-05-20)
- **NÃO usar plugin `"next"`** — causa type checking pesado de páginas/rotas que trava no Actions runner
- `include` estreito: `["src/**/*.ts", "src/**/*.tsx"]` — evita checar node_modules e configs
- `tsBuildInfoFile: ".next/tsconfig.tsbuildinfo"` — cache incremental configurado
- O `tsc --noEmit` NUNCA passou no Actions runner com este projeto. O type checking é feito localmente via VSCode. O deploy no VPS usa `SKIP_TSC=1`

### Middleware — nunca usar regex negativo no matcher
- O `config.matcher` com regex negativo `(?!)` **não funciona** confiavelmente para excluir rotas como `/sw.js` e `/manifest.webmanifest`
- Usar `matcher: "/:path*"` (cobre tudo) e fazer bypass **dentro do código** com array `BYPASS` explícito:
  ```ts
  const BYPASS = [/^\/_next\//, /^\/api\//, /^\/sw\.js$/, /^\/manifest\.webmanifest$/, /^\/favicon\.ico$/, /\.(svg|png|jpg|jpeg|gif|webp)$/]
  if (BYPASS.some(r => r.test(pathname))) return NextResponse.next({ request })
  ```

### Service Worker (`public/sw.js`)
- ⚠️ **Navegação HTML**: usar **NetworkOnly** (NUNCA cachear). O middleware retorna 307 redirect para `/login` quando não autenticado — cachear isso corrompe a experiência com "This page couldn't load"
- **Assets Next.js** (`_next/static/`): NetworkFirst (busca rede primeiro, fallback cache se offline)
- **Outros assets** (scripts, imagens, fonts): StaleWhileRevalidate com validação status 200
- Cache bucket versionado (`"ops-hub-v15"`, incrementar a cada mudança estrutural no SW)
- **Background sync**: removido (era no-op placeholder). O app é 100% client-side com realtime WebSocket — sem conexão, não há mutations para retentar
- **Sem `console.log` em produção**: logs de install/activate/sync foram removidos

### GitHub Actions deploy.yml — anti-padrões
- ⚠️ **NUNCA usar `python3 -c "..."` com aspas duplas** em YAML `script: |`. O Python usa `\n` e aspas escapadas que conflitam com YAML. Usar heredoc `<< 'PYEOF'` com delimitador em single quotes.
- ⚠️ **NUNCA usar template Go com `$` inline** (ex: `docker inspect --format '{{range $k,$v}}...'`). O shell expande `$k` e `$v` como variáveis vazias. Usar `--format '{{json .Field}}'` e parsear com Python.
- **NUNCA usar `set -e`** no início do script completo — esconde erros. Deixar comandos críticos com `|| { echo "FAILED"; exit 1; }` explícitos.
- **command_timeout**: usar `40m` (docker build no VPS é lento: 5-15 minutos)
- **Variáveis de ambiente**: exportar secrets do GitHub Actions como env vars antes do heredoc (`export FOO="${{ secrets.FOO }}"`), depois acessar via `$FOO` dentro de heredoc quoted (que não expande `${{ }}`)
- **Network detection**: `NET=$(docker inspect caddy_proxy --format '{{json .NetworkSettings.Networks}}' | python3 -c "import sys,json; print(list(json.load(sys.stdin).keys())[0])")` — fallback `caddy_default`
- **docker-compose.prod.yml**: simplificado para apenas serviço `app` com `networks: proxy: external: true`. O Caddy é gerenciado FORA do compose

### Pipeline de deploy atual (funcional — 2026-05-20)
- Workflow: **1 job único** (sem typecheck paralelo). O job `typecheck` foi removido — nunca completava no Actions runner (OOM/CPU timeout com ~70 arquivos TS em strict mode)
- Build no VPS usa `SKIP_TSC=1` (permanente). A compilação é via SWC (rápida, ~60s). Type checking local via VSCode + `tsc --noEmit` opcional
- 10 deploys consecutivos verdes (#149-#158)
1. SSH no VPS (`appleboy/ssh-action@v1`)
2. `git clone --depth 1` do repo
3. `echo` das variáveis no `.env.prod` (sem heredoc — evitar conflito de expansão)
4. Detecta rede do `caddy_proxy` via `{{json}}`+Python
5. `docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=... --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... -t ops-hub:latest .`
6. Para container antigo, remove anterior (`suganuma-ops-hub`)
7. `docker run -d --name suganuma-ops-hub --network $NET --env-file .env.prod --restart unless-stopped ops-hub:latest`
8. `~/update-ops-proxy.sh` se existir
9. Verifica `sw.js` contém `"v5"` (sinal de deploy bem-sucedido)

### Secrets necessários no GitHub
- `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` — acesso SSH ao VPS
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` — server-side admin
- `WEBHOOK_SECRET` — HMAC fallback compartilhado dos 3 webhooks
- `EMAIL_SECRET`, `CSV_SECRET`, `DEPLOY_SECRET` — secrets DEDICADOS por webhook (2026-08-29; opcionais — código faz fallback para `WEBHOOK_SECRET` se ausente; wire: `verifyWebhookHmac(req, body, process.env.EMAIL_SECRET || process.env.WEBHOOK_SECRET)`)
- `RAINDROP_TOKEN` — Test Token do Raindrop (não expira)
- `RAINDROP_COLLECTION_IDS` — IDs das collections de conhecimento técnico (CSV, ex: "55561655,55561647")
- `RAINDROP_SYNC_SECRET` — HMAC do endpoint raindrop-sync (secret DEDICADO, não reusa WEBHOOK_SECRET)
- `RAINDROP_MAX_ITEMS_PER_RUN` — cap de itens por run (default no código: 50; o deploy.yml passa 50 também)
- `EMBEDDINGS_RECONCILE_SECRET` — HMAC do endpoint embeddings-reconcile (secret DEDICADO)
- `QDRANT_API_KEY` — API key do servidor Qdrant (QDRANT__SERVICE__API_KEY no container dele)
- `WEB_PUSH_VAPID_PUBLIC_KEY`, `WEB_PUSH_VAPID_PRIVATE_KEY` — chaves VAPID do Web Push (geradas 2026-08-29)
- `COOLIFY_TOKEN` — token API Coolify (opcional, não mais usado no pipeline atual)

### Deploy troubleshooting
- **`rm -rf ~/ops-hub` falha com "Permission denied"**: `node_modules` criado pelo Docker build fica com owner `root`. Rodar `sudo rm -rf ~/ops-hub` antes do próximo deploy
- **GitHub Actions SSH falha instantaneamente**: geralmente causado pelo item acima (rm falha → git clone falha → script aborta). Limpar `~/ops-hub` no VPS resolve

## Testes — Vitest

### Configuração
- Framework: **Vitest 4.1.5**
- Config padrão: `vitest.config.ts` — ambiente `node`, pool `forks`, `singleFork: true`
  - Necessário porque `jsdom`/`happy-dom` travam no Node.js **v25.6.0** local
  - Testes unitários puros (schemas, parsers, contexts) rodam em milissegundos
  - **Exclui `tests/queries/*.test.tsx` via `exclude`** (2026-08-29): DOM tests não pertencem ao node env; antes eram coletados e falhavam com `ReferenceError: document` como "44 falhas" fictícias
- Config DOM: `vitest.dom.config.ts` — ambiente `happy-dom` para testes de componente React
  - Só funciona dentro do container Docker (`node:22-alpine`); localmente trava no Node v25
- Comando: `npm test` → `vitest --no-watch` (só testes node)
- Comando: `npm run test:docker` → builda imagem Docker e roda **todos** os testes com happy-dom

### Testes atuais (2026-08-29)
| Suite | Arquivo | Testes |
|---|---|---|
| Zod schemas | `tests/schemas.test.ts` | 38 |
| OAuth (puro, sem mocks) | `tests/oauth.test.ts` | 15 |
| Webhook HMAC/ID | `tests/webhooks-hmac.test.ts` | 16 |
| Task parser | `src/lib/parse-title.test.ts` | 12 |
| Context tags | `src/lib/contexts.test.ts` | 12 |
| Queries React (DOM) | `tests/queries/*.test.tsx` | 45 |
| Smoke | `tests/queries/smoke.test.ts` | 1 |
| **Total** | | **139** (94 node + 45 DOM) |

> ⚠️ Testes DOM/componentes (`.test.tsx`) travam no Node v25 local. Usar `npm run test:docker` (node:22-alpine). Testes node (`npm test`) funcionam localmente — agora sem falsas falhas.

### Gate de testes no deploy (2026-08-29)
- `deploy.yml` roda `npm ci` + `npx vitest run` **antes** do SSH no VPS — build não sobe com testes vermelhos
- O gate bloqueou 2 deploys na primeira ativação (vitest órfão sem `npm ci`; DOM tests no node env) — provou valor imediatamente
- Rollback de deploy: imagem é taggeada por `GIT_SHA` (`ops-hub:<sha>`) além de `latest` — rollback = `docker run ops-hub:<sha-anterior>`

### Execução
```bash
# Testes unitários locais (Node env)
npm test

# Todos os testes, incluindo componentes React (requer Docker)
npm run test:docker
```

### Boas práticas
- Mocks Supabase: `vi.mock("@/lib/supabase/client")` + função `chain()` fluente
- Mocks Realtime: `vi.mock("@/lib/realtime")` → `useRealtimeTable` no-op
- Não adicionar `jsdom` de volta sem testar no Node v25; `happy-dom` + Docker é a alternativa estável

## Performance — regras e aprendizados (2026-05-20)

### TanStack Query — configuração ótima
- **`refetchOnWindowFocus: false`** global — o app já usa realtime WebSocket (Supabase Postgres Changes), refetch ao focar aba é redundante
- **`staleTime` por query**, não global único:
  - `Infinity`: budget (só muda via mutation explícita), pregnancy (quase estático)
  - `5 * 60_000` (5min): projects, protocols (mudam raramente)
  - `30_000` (30s): tasks, transactions (mudam com frequência, realtime já empurra updates)
  - Demais queries: usam default global `60_000` (notes, meals, habits, calendar)
- **`gcTime: 5 * 60_000`** global (5 minutos) — adequado para dados que o usuário revisita em navegação

### Code-splitting com `next/dynamic`
- **Sempre usar `dynamic(() => import(...))` com `loading:`** para componentes abaixo da dobra ou acionados por interação
- A ordem de lazy-loading aplicada:
  1. `CommandPalette` (cmdk) — já era lazy, via AppShell (mantido)
  2. `RevenueChart` (recharts) — lazy, `/finance`
  3. `CSVImportDialog` (papaparse) — lazy, `/finance`
  4. `ReactMarkdown` — lazy, `/notes`
  5. **`HealthTrends`** (recharts, WeightChart + BloodPressureChart) — lazy, `/health` — **-384 KB** na first load
  6. **`EditTaskDialog`** (407 linhas) — lazy, `/tasks` — **-15 KB**
  7. **`SelectiveImportDialog`** — lazy, `/settings` — **-74 KB**
- **Skeleton `loading:` obrigatório** — `dynamic()` sem fallback causa layout shift e UX ruim
- **Conflito de nomes**: Turbopack não permite importar `type { NoteRow }` e `{ NoteRow }` (componente) no mesmo arquivo. Renomear um deles ou remover type import se não usado
- **Componentes inline NUNCA** — definir componente dentro do mesmo arquivo da página impede tree-shaking. Extrair para `src/components/X/` sempre

### CSS e fontes
- **`--font-geist-mono`**: removido do `@theme inline` — Geist nunca foi importado, era variável morta
- **`@tailwindcss/typography`**: JIT purga classes não usadas automaticamente. CSS code-split não traz ganho real
- **`next/font/google`** com Inter: self-hosting automático, sem requisição externa — continua ótimo

### Dependências
- **`remark-gfm` removido** — zero imports no código, 94 pacotes a menos
- **`require("papaparse")` → `import Papa from "papaparse"`** — tree-shaking correto via ESM
- **`recharts` 3.8.1**: ~150-180 KB. Só usar onde indispensável (RevenueChart, WeightChart, BloodPressureChart). Sempre lazy-load

### Arquivos removidos
- **9 `loading.tsx` deletados** — inúteis em app 100% client-side (páginas são `"use client"`, loading.tsx depende de RSC streaming)

### Bundle atual por rota (2026-05-20, uncompressed)
| Rota | Tamanho | vs antes |
|---|---|---|
| /health | 935 KB | -29% |
| /settings | 835 KB | -10% |
| /tasks | 943 KB | -4% |
| /dashboard | 890 KB | -2% |
| /finance | 954 KB | -2% |
| /login | 743 KB | -2% |
| **/reports** | 844 KB | **agora com cache TanStack** |

### Build
- Local: ~4.5s (`SKIP_TSC=1`)
- VPS: ~60s (Docker build + push)
- **NUNCA adicionar job `typecheck`** no workflow — já removido permanentemente
- **`loading.tsx` NUNCA recriar** — o app é 100% client-side, loading.tsx não funciona sem RSC

### O que NÃO fazer
- Converter páginas para RSC — reescreveria toda arquitetura de dados (TanStack Query + Realtime são client-side)
- Substituir recharts por SVG nativo — 4+ gráficos, horas de trabalho, risco de bugs
- CSS code-split — Tailwind JIT já purga classes não usadas, ganho marginal
- Build cache no Docker — setup atual (`rm -rf` + `git clone`) não aproveita, complexidade não vale

## Dependências notáveis
- `@base-ui/react` — Dialog, Checkbox, Button (NÃO Radix)
- `@tanstack/react-query` + devtools
- `@tanstack/react-virtual` — virtualização de listas (>50 itens)
- `recharts` — gráficos (RevenueChart, WeightChart, BloodPressureChart). Sempre lazy-load
- `react-markdown` — renderização de markdown nas notas (`remark-gfm` removido)
- `papaparse` — import CSV de extratos bancários
- `cmdk` — command palette
- `next-themes` — dark/light mode
- `serwist` — removido do bundle; SW é manual (`public/sw.js`)
- `@modelcontextprotocol/sdk` — MCP server (Streamable HTTP) e stdio proxy. Versão 1.29+
- `zod` — v4.3.6. Tem `toJSONSchema()` nativo, mas MCP SDK já suporta Zod diretamente

## Pontos de atenção
- **`@tailwindcss/typography` instalado (2026-05-09)**: Versão `0.5.0-alpha.3` (tag `next`) funciona com Tailwind v4 via `@plugin "@tailwindcss/typography"` no `globals.css`.
- Node.js v25.6.0 local, **v22-alpine em produção** — vitest 4.1.5 funciona mas pode ter instabilidades. Usar `--no-watch`.
- **Build**: `SKIP_TSC=1` no Dockerfile (permanente). Build no VPS ~60s via SWC. Type checking via VSCode local, NÃO no deploy.
- **Workflow**: 1 job único (sem typecheck paralelo). Job `typecheck` removido em 2026-05-20 — nunca completava (~70 arquivos TS strict).
- BottomNav mobile máximo 5 itens (DASH, INBX, TASKS, FIN, HUB). HUB menu: COCK, NOTES, PROJ, CAL, REV, HLTH, SET
- `due_at` é `string | null` no DB mas `string | undefined` no Zod schema — usar `undefined` nos mutations
- **Realtime**: tabelas adicionadas à `supabase_realtime` publication: task, account, transaction, note, meal, meal_plan, habit_track, habit_entry, project, budget, appointment, health_log, pregnancy, protocol, protocol_entry, annual_event, **inbox_item**
- **Realtime debounce**: invalidações são debounce por 300ms por prefixo (`pendingInvalidations` Map em `realtime.ts`). Múltiplas mudanças simultâneas (ex: 3 tabelas invalidando `calendar`) resultam em 1 refetch em vez de 3
- **`TABLE_QUERY_PREFIX`** mapeia tabelas DB → prefixes de query key: `task→["tasks","calendar","reports"]`, `appointment→["health","calendar"]`, `meal_plan→["meals","calendar"]`, `transaction→["finance","reports"]`, `habit_entry→["habits","reports"]`, `inbox_item→["inbox"]`, etc. Tabelas podem invalidar múltiplos prefixes
- **Tipos planos** (`src/lib/types/*.ts`): 9 arquivos (task, project, finance, health, note, meal, habit, budget, index). Substituem `database.types.ts` para type checking
- **Migrations SQL executadas manualmente** via Supabase SQL editor (0010-0033). NÃO são executadas automaticamente pelo deploy
- **Migration 0030**: `mcp_audit_log` — audit log para MCP tool calls
- **Migration 0031**: `webhook_event` — idempotency tracking para webhooks
- **Migration 0032**: `inbox_item` — captura de atrito zero com triagem posterior
- **Migration 0033**: `search_vector` tsvector + GIN em note/task — Hybrid RAG (FTS + Vector + RRF)
- **Migration 0034**: `energy_level` em task (low/med/high) — filtro de energia disponível
- **Migration 0035**: `oauth` — custom connector OAuth 2.1 (claude.ai)
- **Migration 0036**: `note_attachments_private` — ajuste de storage para attachments
- **Migration 0037**: `'raindrop'` no check de `inbox_item.source` — ponte Raindrop → Hub (aplicada no VPS via `docker exec` psql, ver lição 2026-08-27)
- **`queryOptions` API TanStack v5**: Todas as queries exportam `queryOptions`. `staleTime` e `gcTime` configurados por query (ver seção Performance). `refetchOnWindowFocus: false` global
- **`sw.js`**: versão `v16`. Estratégia: `_next/static` NetworkFirst, navegação NetworkOnly. Sem background sync (removido placeholder no-op)
- **Next.js 16 `next.config.ts`**: `reactCompiler: true` em root (não `experimental`). `typedRoutes` quebra build com BottomNav strings. `headers()` com `source: "/:path*"` funciona (sintaxe simples); `headers()` com regex `/icon-:size*` quebra Turbopack
- **Security headers** (2026-06-19): HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy configurados via `headers()` em `next.config.ts`
- **Escaping de caracteres no write tool**: `\u00cd` e outros escapes Unicode podem aparecer em vez de caracteres acentuados ao usar o `write` tool. Sempre revisar arquivos escritos e corrigir acentos manualmente

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

## Data Safety (2026-06-19)
- **Reports query bounded**: `useReports(period)` filtra por data no DB (30/90/365 dias). Tasks limit 500, transactions limit 1000, habit entries limit 1000. `period="all"` não filtra mas ainda limita
- **CSV import Zod validation**: cada row do CSV é validada contra `transactionSchema` antes de inserir no DB. Rows inválidas são silenciadas
- **Export/Import FK sanitization**: import stripa FKs cross-tabela para evitar dangling references ao importar dados de outro usuário
- **JSON column validators**: `parseAttachments` (notes), `parseWeightValue`/`parseBloodPressureValue`/`parseGlucoseValue`/`parseHealthLogValue` (health_log.value) — substituem casts `as Type`
- **`.error` checked em todos `Promise.all`**: calendar.ts (3 queries), reports.ts (4 queries), budget.ts (maybeSingle lookup), meals.ts (meal_plan lookup). Ignorar `.error` causava linhas duplicadas em upserts e perda silenciosa de dados
- **Reports tem realtime**: `useReports` chama `useRealtimeTable("task")`, `useRealtimeTable("transaction")`, `useRealtimeTable("habit_entry")`. `TABLE_QUERY_PREFIX` mapeia essas tabelas para `reports` prefix
- **Sem useEffect+Supabase direto**: HabitStats e WeeklyReview migrados para TanStack Query (`useAllHabitEntries`, `useHabits`). Componentes que fazem query em useEffect sem `.catch()` travam em loading infinito se a rede falha

## Component Patterns (2026-06-19)
- **`React.memo` + stable callbacks**: `NoteRow` e `TaskRow` envolvidos em `memo()`. TaskRow aceita callbacks com args (`onToggle: (id, status) => void`) em vez de closures, permitindo que o parent passe `useCallback` estáveis. **Padrão obrigatório para componentes em lista**: passar callbacks com args, não closures `() => handler(item.id)`
- **`useReducer`**: `EditTaskDialog` usa 1 `useReducer` (12 campos de formulário) em vez de 12 `useState`
- **Grouped state objects**: `YearView` (dialog state) e `SettingsPage` (token UI state) usam 1 `useState` agrupado em vez de múltiplos independentes
- **Lazy queries**: `useProjects({ enabled })` e `useUpcomingEvents(limit, { enabled })` aceitam option `enabled` para deferring. Dashboard usa `deferredReady` state para adiar queries below-the-fold
- **`useMemo` para computações pesadas**: NeedsAttention, ContextNotesWidget, WeeklyReview, EisenhowerMatrix, HabitStats, RevenueChart, HealthTrends, AppointmentList. **Sempre memoizar**: filtering, sorting, Set construction, O(n²) loops
- **`useEffect` com deps primitivas**: NUNCA usar `[task]` ou `[transaction]` como dep — usar `[task?.id, task?.title, ...]`. Objeto de TanStack Query muda de identidade a cada refetch, causando reset desnecessário de estado local
- **Suspense em `useSearchParams()`**: Next.js 16 exige `<Suspense>` boundary. Padrão: extrair body em `XxxPageInner`, default export envelopa em `<Suspense fallback={...}>`
- **Lazy-load dialogs via `dynamic()`**: diálogos só abrem por interação — usar `dynamic(() => import(...).then(m => ({ default: m.X })), { ssr: false })`. Já lazy: EditTaskDialog, QuickAddDialog, AddTransactionDialog, EditTransactionDialog, BiometricLogDialog, AddAppointmentDialog, AddProtocolDialog, CreateProjectDialog, ProjectNotesDialog, DayDetailModal
- **Loading skeletons**: Dashboard, Meals, Review — `{isLoading && <skeleton/>}` + `{!isLoading && <content/>}`. Previne layout shift (CLS)
- **`useAllProtocolEntries` pattern**: quando múltiplos componentes precisam de entries de protocols diferentes, usar 1 query `useAllProtocolEntries()` no parent e passar via props. NUNCA chamar hooks em `.map()`
- **`useAllHabitEntries` pattern**: mesmo padrão para habits. HabitStats e WeeklyReview usam `useAllHabitEntries` em vez de N queries por habit
- **NoteRow `tasks` prop**: `useTasks()` chamado no parent (NotesPage, ProjectNotesDialog) e passado via prop. Elimina N subscrições `useRealtimeTable("task")` (uma por NoteRow)
- **`keepPreviousData` em paginação**: `transactionsOptions` usa `placeholderData: keepPreviousData` para transições suaves entre meses no Finance
- **`enabled` flag em queries condicionais**: `dailyNoteOptions` tem `enabled: !!date` — previne fetch quando DayDetailModal está fechado
- **BottomNav `safe-area-inset-bottom`**: `pb-[env(safe-area-inset-bottom)]` no inner div — previne home indicator overlapping em iPhones
- **Componentes extraídos de pages**: HabitRow, AddMealForm, MealRow extraídos de `habits/page.tsx` e `meals/page.tsx`. Componentes inline em páginas impedem tree-shaking — sempre extrair para `src/components/X/`

---

## Notes Module — Current State (2026-06-04)

| Aspecto | Estado |
|---|---|
| Schema | `note`: id, owner_id, title, content, tags[], pinned, linked_task_id, **para**, **daily_date**, **is_moc**, **last_review**, **project_id**, **favorited**, created_at, updated_at |
| Queries | Full CRUD TanStack Query + optimistic updates + realtime |
| Editor | Plain textarea 6 rows + react-markdown render (lazy, SSR false) |
| Task integration | Bidirecional: `→TASK` button; EditTaskDialog shows linked notes |
| CommandPalette | Shows up to 3 favorited notes + up to 3 pinned notes; context groups (`ctx/work` etc.); tag search group; navigates to `/notes` |
| PARA | Categories: projects, areas, resources, archive — filterable in NotesPage |
| Frontmatter | YAML parser `src/lib/frontmatter.ts` — metadata badges in NoteRow |
| Daily Notes | `daily_date` column + `DayDetailModal` create/edit from calendar |
| Wiki Links | `[[Note]]` syntax → rendered as links + backlinks section |
| Inline Tasks | `- [ ]` detected + checkbox sync with task module |
| MOCs | `is_moc` flag — Maps of Content shown first in NotesPage |
| Tag Namespaces | Tags with `/` prefix grouped for hierarchical filtering |
| Templates | QuickAddNote with 6 templates (standard, MOC, daily, project, area, resource) |
| Review Badge | Areas with `last_review` > 30 days show ⚠ REV warning |
| **Semantic Search** | **Ollama (nomic-embed-text) + Qdrant self-hosted; Busca Semântica panel em NotesPage; embedding auto-sync on note CRUD (create/update/delete via `syncNoteEmbedding`/`deleteNoteEmbedding` server actions)** |
| **Contexts** | **6 life contexts (work, pessoal, casa, saude, estudos, financas) with color-coded pills + strip in NoteRow + filter bar in NotesPage + QuickAdd selector + edit mode toggle** |

## Notes Feature Roadmap

| Phase | Features | Complexity | Prerequisite |
|---|---|---|---|
| **1 — Foundation** ✅ | PARA categorization + Frontmatter YAML parser + Daily Notes | Low | — |
| **2 — Connectivity** ✅ | Bidirectional links `[[Note]]` + Inline tasks `- [ ]` sync | Medium | Phase 1 |
| **3 — Intelligence** ✅ | Semantic search (Ollama + Qdrant) + Embedding auto-sync on CRUD | High | Ollama + Qdrant on VPS |

### Implementation Notes
- **Frontmatter**: Parse `---\nkey: value\n---` from top of `content` column; no schema migration needed for metadata
- **PARA**: Add `para` column (ENUM) or reuse `tags` with reserved prefix `#para-projects` etc. Migration `0025_note_para.sql`
- **Daily Notes**: Query by title pattern `YYYY-MM-DD` OR add `daily_date` column; link from calendar
- **Bidirectional links**: Regex `\[\[(.*?)\]\]` in content; use `title` as temporary key (no slugs yet); backlinks via `content LIKE '%[[title]]%'`
- **Inline tasks**: Detect `- [ ]` / `- [x]` in content; sync creates/updates tasks via `linked_note_id` on task table
- **Semantic search**: Implemented with Ollama (nomic-embed-text) + Qdrant self-hosted. Embeddings auto-synced via `syncNoteEmbedding`/`deleteNoteEmbedding` server actions on note CRUD

## Deploy Critical Lessons — Session History (Cumulative)

| Date | Lesson | Trigger |
|---|---|---|
| 2026-05-09 | `node:22-alpine` base image (upgraded from v20) | Performance optimization |
| 2026-05-10 | HEALTHCHECK in Dockerfile using `node -e "http.get(...)"` — no curl in Alpine | Docker best practice |
| 2026-05-20 | Removed job `typecheck` from GitHub Actions — OOM/CPU timeout (~70 TS files strict mode) | Build failure |
| 2026-05-20 | Removed 9 `loading.tsx` files — useless in 100% client-side app | RSC not used |
| 2026-06-01 | `headers()` in `next.config.ts` with `path-to-regexp` syntax `/icon-:size*` **repeatedly crashes Turbopack build**. Removed permanently | Production crash |
| 2026-06-01 | Duplicate `useAnnualTasks` function definition in same file (`annual.ts`) causes build failure. Deduplicate immediately | Production crash |
| 2026-06-01 | Rolled back to `0d0f67a` when Google Calendar sync branch broke deploy | Recovery strategy |
| 2026-06-02 | `themeColor: "#121212"` in `metadata: Metadata` causes Next.js 16 production warnings. Use separate `export const viewport` | Build warning |
| 2026-06-02 | Caddy proxy requires explicit `caddy reload --config /etc/caddy/Caddyfile` after container swap when Caddyfile is volume-mounted. Docker auto-restart does NOT pick up new upstream containers | Deploy verification |
| 2026-06-02 | Service Worker version bump is the **canonical cache-bust strategy** after Server Action hash mismatches | Cache invalidation |
| 2026-06-02 | `console.warn` replaced with `throw new Error` to avoid console pollution in production | Code quality |
| 2026-06-18 | **Caddyfile MUST use container name (`suganuma-ops-hub:3000`), NOT hardcoded IP**. Container IPs change on every recreation (`docker run`); Caddy 2.11 resolves container name via Docker DNS and falls back to IPv4 automatically when IPv6 fails (Next.js doesn't listen on IPv6). Hardcoded IP caused 502 after deploy because bind-mounted Caddyfile wasn't synced into `caddy_proxy` container without full `docker restart caddy_proxy`. Container name DNS eliminates the problem entirely | 502 outage |
| 2026-06-19 | **`proxy.ts` convention breaks Next.js 16.2.6 build** (`ENOENT: middleware.js.nft.json`). The `proxy` file convention is documented as the replacement for `middleware`, but 16.2.6 still expects `middleware.js.nft.json` in the standalone output step. Keep `middleware.ts` until Next.js fixes this bug. The deprecation warning is harmless | Build failure |
| 2026-06-19 | **`rm -rf ~/ops-hub` fails when `node_modules` has root-owned files** from Docker build. The deploy script's `rm -rf ops-hub` can fail with "Permission denied" on `node_modules/` files created by Docker. Fix: `sudo rm -rf ~/ops-hub` before re-running deploy, or use `docker run --rm -v ...` to avoid creating root-owned files in the host `node_modules` | Deploy failure |
| 2026-06-19 | **`headers()` com `source: "/:path*"` funciona no Next.js 16** — ao contrário de `/icon-:size*` que quebra o Turbopack. Sintaxe simples de path matching é segura | Security headers |
| 2026-06-19 | **Zod 4 tem `toJSONSchema()` nativo** (`import { toJSONSchema } from "zod"`), mas o MCP SDK já suporta schemas Zod diretamente em `registerTool` via `zod-json-schema-compat`. Não é necessário converter manualmente | MCP type safety |
| 2026-06-19 | **`syncNoteEmbedding` era dead code** — definida mas nunca chamada. Notas criadas/atualizadas não eram indexadas no Qdrant. Wire no `onSettled` das mutations resolve | Semantic search bug |
| 2026-06-19 | **MCP SDK aceita Zod schemas v3 e v4 diretamente** como `inputSchema` em `registerTool`. O `as any` cast era desnecessário — o tipo `AnySchema = z3.ZodTypeAny \| z4.$ZodType` cobre ambos | MCP type safety |
| 2026-06-19 | **Caddy bind mount não sincroniza Caddyfile ao vivo** — o arquivo dentro do container pode divergir do host. `docker restart caddy_proxy` força releitura. Usar nome de container no Caddyfile elimina a necessidade de editar após cada deploy | Caddy proxy |
| 2026-07-16 | **SSH key está no Nextcloud, NÃO no OneDrive** — `~/Library/CloudStorage/Nextcloud-leonardo@nextcloud․suga․com․br/Resources/Chave_Leo`. O `~/.ssh/config` aponta para OneDrive (stale). Usar caminho Nextcloud para SSH | SSH connection |
| 2026-07-16 | **WEBHOOK_SECRET precisa de deploy para entrar no container** — adicionar o secret no GitHub Actions NÃO atualiza o container em execução. O `.env.prod` só é reescrito no próximo deploy. Commit vazio (`git commit --allow-empty`) força novo deploy | Webhook auth |
| 2026-07-16 | **Rate limiting via middleware é mais eficiente que por-rota** — aplicar `checkAgentRateLimit` em `/api/agent/*` no `middleware.ts` protege 25 rotas com 1 interceptador, sem modificar cada route handler | Agent API security |
| 2026-07-16 | **Ignorar `.error` em `maybeSingle()` causa linhas duplicadas** — budget e meal_plan faziam lookup antes de insert/update. Se o lookup falhava (DB transitório), `.error` era ignorado, `existing` era `null`, e o código fazia INSERT em vez de UPDATE. Sempre checar `.error` | Data corruption bug |
| 2026-07-16 | **useEffect + Supabase sem `.catch()` trava componente para sempre** — HabitStats e WeeklyReview faziam queries em `useEffect([])` sem error handling. Se a rede falhava, `loaded` nunca virava `true`. Migrar para TanStack Query resolve (error/loading automáticos) | UX bug |
| 2026-07-16 | **`useEffect(..., [note])` com objeto causa reset desnecessário** — `note` muda de identidade a cada re-render do parent (array TanStack Query). Depender de `[note.id, note.title, note.content, note.linked_task_id]` evita reset de estado local | React perf |
| 2026-08-09 | **Rules of Hooks: `useMemo` após `return` condicional quebra em runtime** — `reports/page.tsx` chamava `useMemo` depois de `if (isLoading) return ...`. Quando `isLoading` transitava de true→false, a ordem de hooks mudava. Mover `useMemo` antes do early return com guard `data ? compute(data) : null` | React crash |
| 2026-08-09 | **Hooks em `.map()` viola Rules of Hooks** — `ProtocolsSummary` chamava `useProtocolEntries(p.id)` dentro de `active.map()`. Se o número de protocols ativos mudava entre renders, React crashava. Solução: query única `useAllProtocolEntries()` + filtragem no `useMemo` | React crash |
| 2026-08-09 | **`React.memo` quebrado por callbacks instáveis** — `TaskRow` tinha `memo()` mas o parent passava `() => handleToggle(task.id, task.status)` (nova closure a cada render). Solução: callbacks com args `onToggle: (id, status) => void` + `useCallback` no parent. O memo só funciona se TODAS as props são estáveis | React perf |
| 2026-08-09 | **JSX `)}` fora de ordem em skeleton wrappers quebra build SWC** — ao envolver conteúdo em `{!isLoading && (<div>...</div>)}`, o `)}` deve vir ANTES do `</div>` do wrapper externo. Ordem correta: `</div>` (interno) → `)}` (condicional) → `</div>` (externo). Balance check de `()` e `{}` não pega este erro — usar `ts.createSourceFile` para validar | Build failure |
| 2026-08-09 | **`useSearchParams()` sem `<Suspense>` falha no prerender do Next.js 16** — build warning → erro em standalone output. Padrão: extrair body em `XxxPageInner()`, default export envelopa em `<Suspense fallback={<div className="h-32 animate-pulse" />}>` | Build failure |
| 2026-08-10 | **Ollama Cloud não tem modelos de embedding** — `https://ollama.com/api/tags` lista apenas modelos de chat (gpt-oss, deepseek-v4, glm, etc.). Embeddings devem continuar locais (nomic-embed-text no VPS). Separar `OLLAMA_URL` (embeddings local) de `OLLAMA_CLOUD_URL` (chat cloud) | Architecture |
| 2026-08-10 | **Ollama Cloud usa API idêntica ao local** — mesmo `/api/chat` com `format: "json"`, mas com header `Authorization: Bearer $OLLAMA_API_KEY`. Fallback: se key ausente ou cloud falhar, cair para local `llama3.2` — nada quebra | Architecture |
| 2026-08-10 | **GitHub Secrets só entram no container no próximo deploy** — adicionar `OLLAMA_API_KEY` ao GitHub Actions NÃO atualiza o container em execução. Commit vazio (`git commit --allow-empty`) força novo deploy | Deploy |
| 2026-08-10 | **MCP Resources exigem `resources` capability no `McpServer`** — sem `resources: { listChanged: false }` no constructor options, `registerResource` não é anunciado ao client. Adicionar capability + registrar handlers com `ctx.ownerId` para scoping | MCP |
| 2026-08-10 | **`energy_level` em tasks: token `~low\|med\|high` no parseTitle** — novo token adicionado após `^date`. Sintaxe completa: `>projeto #cat !pri ^date @del +imp *rec ~energy`. Badge no TaskRow: DEEP (high/purple), MED (med/neutral), QUICK (low/teal) | Feature |
| 2026-08-10 | **`triageAllPending` server action precisa de hook + botão UI** — a função existia mas não estava wired na UI. Hook `useTriageAllPending` + botão "TRIAR TUDO" no header do /inbox resolve. Processa até 20 items sem `ai_payload` | Inbox |
| 2026-08-19 | **`middleware.ts` na raiz E em `src/` ao mesmo tempo — Next.js carrega a raiz em silêncio**, mesmo o projeto usando `src/app`. Sem erro de build, sem warning. Rate limiting de `/api/agent/*` documentado neste arquivo nunca esteve ativo em produção por meses — a versão ativa (raiz) não tinha esse código. Sempre confirmar que existe só UM `middleware.ts` antes de debugar por que ele "não faz efeito" | Auditoria de segurança |
| 2026-08-19 | **Padrão "marcar como usado" com `.update().is(col, null)` precisa checar linhas afetadas do UPDATE, não um SELECT anterior** — do contrário, troca concorrente do mesmo authorization code (ou qualquer recurso de uso único) passa despercebida. Corrigir com `.update(...).is(col, null).select("id")` e checar `.length === 0` | Race condition em exchangeAuthorizationCode |
| 2026-08-27 | **Supabase é self-hosted no VPS — migrations rodam via SSH, sem SQL Editor** — `ssh LeoVM 'docker exec -i supabase-db psql -U supabase_admin -d postgres' < supabase/migrations/XXXX.sql`. O dono das tabelas é `supabase_admin`, NÃO `postgres` (`psql -U postgres` falha com "must be owner of table"). Container do DB: `supabase-db` | Migration 0037 (Raindrop) |
| 2026-08-27 | **`gh` CLI autenticado como leosuga permite gerenciar secrets e workflows do Mac** — `gh secret set`, `gh workflow run "Nome"`, `gh run watch`. Deploy de feature branch: `git push origin feat/x:main` (fast-forward) dispara o deploy sem checkout de main. O nome no `gh workflow run` é o campo `name:` ("Raindrop Sync"), não o filename | Dev workflow |
| 2026-08-27 | **Raindrop API tem filtro nativo de data via search operators** — `search=created:>YYYY-MM-DD` (granularidade de DIA). Test Token não expira; `perpage` máx 50; cada raindrop traz `collection.$id`. Com collections pessoais grandes no account, buscar por collection-alvo individual (N chamadas), nunca `collectionId=0` | Integração Raindrop |
| 2026-08-27 | **Viés de classificador LLM importa em volume** — "actionable na dúvida" mandou 56% de um backlog técnico (~2.1k itens) pro Inbox = pilha movida, não resolvida. Recalibrado para reference-bias → 98/2. Validar o ratio com 1 run pequeno ANTES de varrer o backlog inteiro (dedup impede reprocessar barato) | Raindrop Sync |
| 2026-08-29 | **`SKIP_TSC=1` esconde bugs reais — sessão com ~19 type errors latentes encontrados ao rodar build com tsc ativo** — incluíam: `dateStr` import shadowed por parâmetro de função (chamado como função → quebraria runtime ao mover evento), `habit.emoji`/`.color` acessando colunas que NÃO existem no DB (validar schema real via psql antes de acessar prop de Row), `important` faltando em 6 `createTask` mutates, `parseLimitParam` com fallback string, Zod 4 `z.record` exige 2 args (key+value). **Rodar `npm run build` (tsc ativo) localmente antes de deploys grandes** | Type safety |
| 2026-08-29 | **Export/Import truncava backup silenciosamente** — `.select("*")` sem paginação respeita o max-rows de 1000/request do self-hosted; tabelas grandes (tasks/transactions/notes) truncavam no ÚNICO backup. `exportAllData` agora pagina `.range()`; imports em chunks de 500. Seleção de tabela por row-count também causava FK violation (ordem não parent-first) — SelectiveImportDialog reutiliza `IMPORT_ORDER`/`FK_COLUMNS_TO_STRIP` de export-import.ts | Data safety |
| 2026-08-29 | **Fetch sem timeout em clients de IA trava server actions indefinidamente** — `fetchWithTimeout()` (`src/lib/fetch-with-timeout.ts`, AbortController + clearTimeout) é o padrão para ollama (120s), qdrant (10s), raindrop (30s); env-overridable (`*_TIMEOUT_MS`). Pattern já existia em mcp/api.ts — replicar em toda fetch externa nova | Reliability |
| 2026-08-29 | **Safe-area inset DENTRO de container com altura fixa (h-14, border-box) clipa o conteúdo** — inset-bottom do iPhone é 34px; restavam 22px para ~34px de conteúdo → ícones da BottomNav cortados ao meio no PWA. Padrão correto: padding do safe-area no elemento PAI (sem altura fixa), conteúdo em altura fixa própria, `max(env(...),8px)` para padding mínimo quando inset=0. Overlays (sheet, toast) ancoram via `calc(56px + env(safe-area-inset-bottom))` | iOS PWA layout |
| 2026-08-29 | **SVG que desenha até a borda do viewBox clipa stroke** — stroke 1.2 em path que chega a x=16 de um viewBox 16×16 estende até 16.6 (stroke centerline + metade). Redraw em grid com margem de ≥1.5px do stroke à borda do viewBox. `overflow-visible` resolve, mas redraw é determinístico em qualquer escala | SVG design |
| 2026-08-29 | **Gate de testes no deploy bloqueou 2 deploys na 1ª ativação** — `npx vitest` sem `npm ci` baixa vitest órfão (sem deps do projeto); DOM tests colhidos no node env falham com `document is not defined`. Correção: `npm ci` antes + `exclude` de `*.test.tsx` no `vitest.config.ts`. Gate funciona — não removê-lo para "resolver" falha | CI/Deploy |
| 2026-08-29 | **LLM outputs vão para o DB — validar com Zod schema + `.catch()` fallbacks, não confiar no JSON mode** — `suggested_tags` da triagem aceitava qualquer tipo (string, número, null). Pattern: `z.object({...}).catch(fallback)` por campo; mesmo padrão do `normalizeClassification` do raindrop. E **sanitizar conteúdo externo (Raindrop) no prompt E no output persistido** (`sanitizeLlmText`): bookmark malicioso não pode injetar instruções | LLM security |
| 2026-08-29 | **Container multi-rede quebra scripts que extraem IP com `{{range .NetworkSettings.Networks}}`** — range itera TODAS as redes e `head -1` de output em linha única CONCATENA os IPs (`10.0.2.2` + `172.23.0.8` → `10.0.2.2172.23.0.8` no upstream do Caddy → site 502 inteiro). Fix estrutural no `update-ops-proxy.sh`: upstream SEMPRE por nome de container, nunca IP | Caddyfile corruption |
| 2026-08-29 | **Serviço com auth (Qdrant + API key) + client que nunca enviou a key = integração morta silenciosa** — 401 em toda chamada era engolido pelos fallbacks (FTS). A coleção `ops_hub_notes` nunca existiu. Diagnosticado ao rodar o reconcile job (nova route) + ler LOGS do servidor Qdrant. Ao integrar serviços com auth: testar uma chamada real de dentro do container antes de assumir que funciona; olhar logs do SERVIDOR, não só do client | Silent infra failure |
| 2026-08-29 | **DNS Docker não cruza redes** — app na `coolify`, Qdrant na `rede_data` = `bad address`. Deploy conecta o container às 2 redes (`docker network connect rede_data suganuma-ops-hub` pós-run). Non-fatal no deploy: semantic search degrada, app não para | Docker networking |
| 2026-08-29 | **Reconcile job provou valor na 1ª run**: descobriu os dois problemas acima e indexou as primeiras 50 notas (2168 scanned, cap 50/run). Monitorar progresso via response JSON (`current` crescendo, `missing` caindo) | Embeddings |
| 2026-08-29 | **`next_page_offset` do Qdrant scroll vem DENTRO de `result`** (não no topo da resposta) — ler do topo quebra a paginação silenciosamente: o mapa de hashes ficava limitado a 256 (1ª página) e ~1850 notas eram "missing" para sempre, com as MESMAS 50 re-embedadas a cada run (count travado). Sempre validar paginação com o volume REAL esperado (`missing + current == scanned`) | Qdrant API |
| 2026-08-29 | **`fetch` do Next runtime em Route Handlers: comportamento de cache/dedup não-observável quebrou o reconcile** — scroll/PUT via global fetch não persistiam de forma confiável (count do Qdrant fixo enquanto `reEmbedded:50/errors:[]`). Fix definitivo: `src/lib/qdrant.ts` reescrito com **`node:http` nativo** (`qdrantRequest`). Client HTTP para infra self-hosted dentro do Next: preferir node:http/fetch com `cache:"no-store"`, e validar persistência REAL (count antes/depois) | Next.js runtime |
| 2026-08-29 | **Reconcile bulk indexou 2168 notas em 36 runs (~75s/run)** — padrão do loop: executar UMA run do endpoint em série com `sleep 5`; parar quando `capped:false`. Log do progresso: `missing` caindo, `current` subindo. Com `RECONCILE_MAX_RE_EMBEDS` alto (ex: 500) caberia em ~5 runs | Ops runbook |
| 2026-08-29 | **/api/health agora reporta Qdrant**: `qdrant: ok/error/unavailable` + `notesIndexed` (count com filter owner_id). Falha do Qdrant NÃO derruba o health (app degrada p/ FTS) — status 200 com `qdrant:"error"` é o sinal de alerta. Monitorar esse campo | Observability |
| 2026-08-29 | **Validação de qualidade do semantic search (pós-indexação)**: queries pessoais recuperam notas internas com scores 0.64-0.79 (Raindrop Sync State, briefing diário, LinkedIn tracker); queries genéricas afundam no mar de 2155 recursos técnicos (esperado — usar filtro `para` na UI e hybrid FTS). Threshold 0.5 do vector + RRF k=60 mantidos | Search quality |
| 2026-08-29 | **CSP com nonce migrada com sucesso** — middleware gera nonce (crypto.randomUUID global, NÃO node:crypto que não existe no Edge) + `strict-dynamic`; Next injeta automaticamente nos scripts das páginas dinâmicas. CSP removida do next.config.ts (duplicar = interseção de políticas = quebra). Statics (/, /login, /callback) mantêm CSP compat com unsafe-inline (nonce exige dynamic render). Fontes/dns extras: `img-src https: cdn.jsdelivr.net` | CSP |
| 2026-08-29 | **Offline fallback em camadas no SW (v17)**: navegação online cacheia a última página 200 em cache separado (`last-good-html`, NUNCA redirects 307); offline serve essa página (shell client-side + dados do TanStack persistido) antes de cair para offline.html. Experiência offline muito melhor sem quebrar a regra do 307 | PWA offline |
