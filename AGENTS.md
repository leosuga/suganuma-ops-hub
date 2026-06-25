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
- **Recorrência** (`0014_recurrence.sql`): ao concluir task com `recurrence`, o sistema auto-cria a próxima task (due_at = +1d/+7d/+1m). A nova task herda: título, categoria, prioridade, projeto, delegado, importante, tags
- **Tags** (`0015_tags.sql`): coluna `tags text[]` na task. Exibidas como pills `#tag` no TaskRow. Filtro por tag na TasksPage
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

## Export/Import (2026-06-19)
- `exportAllData()` / `importAllData(json)` em `src/lib/export-import.ts`
- Exporta **16 tabelas**: task, project, account, transaction, health_log, pregnancy, appointment, protocol, protocol_entry, note, meal, meal_plan, habit_track, habit_entry, budget, annual_event
- Import total: substitui `owner_id` pelo usuário atual, stripa `id`/`created_at`/`updated_at`, **stripa FKs cross-tabela** (`project_id`, `linked_task_id`, `account_id`, `meal_id`, `habit_id`, `protocol_id`, `pregnancy_id`, `series_id`) para evitar dangling references
- Import em ordem parent-first (project, account, meal, habit_track, protocol, pregnancy, annual_event, ...)
- Export version: `0.2.0`
- **Import seletivo** (`src/components/settings/SelectiveImportDialog.tsx`): dialog que lista tabelas do JSON com contagem de linhas, permite selecionar quais importar
- UI na página Settings com 3 botões: Exportar backup, Importar seletivo, Importar tudo

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
- **Container da app em produção**: nome `suganuma-ops-hub`, imagem `ops-hub:latest`, na rede `coolify` (compartilhada com Caddy)

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
- **Background sync**: handler é no-op placeholder (`Promise.resolve()`). Não tenta reenviar mutations falhadas
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
- `WEBHOOK_SECRET` — HMAC webhooks (legado, fallback)
- `EMAIL_SECRET` — webhook email-to-task (HMAC separado)
- `CSV_SECRET` — webhook csv-from-bank (HMAC separado)
- `DEPLOY_SECRET` — webhook deploy-status (HMAC separado)
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
- Config DOM: `vitest.dom.config.ts` — ambiente `happy-dom` para testes de componente React
  - Só funciona dentro do container Docker (`node:22-alpine`); localmente trava no Node v25
- Comando: `npm test` → `vitest --no-watch` (só testes node)
- Comando: `npm run test:docker` → builda imagem Docker e roda **todos** os testes com happy-dom

### Testes atuais
| Suite | Arquivo | Testes |
|---|---|---|
| Zod schemas | `tests/schemas.test.ts` | 38 |
| Task parser | `src/lib/parse-title.test.ts` | 12 |
| Context tags | `src/lib/contexts.test.ts` | 12 |
| Queries React | `tests/queries/*.test.tsx` | 45 |
| Smoke | `tests/queries/smoke.test.ts` | 1 |
| **Total** | | **108** |

> ⚠️ Testes DOM/componentes (`.test.tsx`) travam no Node v25 local. Usar `npm run test:docker` (node:22-alpine). Testes unitários (`npm test`) funcionam localmente.

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
- BottomNav mobile máximo 5 itens (DASH, CAL, TASKS, FIN, HUB)
- `due_at` é `string | null` no DB mas `string | undefined` no Zod schema — usar `undefined` nos mutations
- **Realtime**: tabelas adicionadas à `supabase_realtime` publication: task, account, transaction, note, meal, meal_plan, habit_track, habit_entry, project, budget, appointment, health_log, pregnancy, protocol, protocol_entry, annual_event
- **Realtime debounce**: invalidações são debounce por 300ms por prefixo (`pendingInvalidations` Map em `realtime.ts`). Múltiplas mudanças simultâneas (ex: 3 tabelas invalidando `calendar`) resultam em 1 refetch em vez de 3
- **`TABLE_QUERY_PREFIX`** mapeia tabelas DB → prefixes de query key: `task→["tasks","calendar"]`, `appointment→["health","calendar"]`, `meal_plan→["meals","calendar"]`, etc. Tabelas podem invalidar múltiplos prefixes
- **Tipos planos** (`src/lib/types/*.ts`): 9 arquivos (task, project, finance, health, note, meal, habit, budget, index). Substituem `database.types.ts` para type checking
- **Migrations SQL executadas manualmente** via Supabase SQL editor (0010-0031). NÃO são executadas automaticamente pelo deploy
- **Migration 0030**: `mcp_audit_log` — audit log para MCP tool calls
- **Migration 0031**: `webhook_event` — idempotency tracking para webhooks
- **`queryOptions` API TanStack v5**: Todas as queries exportam `queryOptions`. `staleTime` e `gcTime` configurados por query (ver seção Performance). `refetchOnWindowFocus: false` global
- **`sw.js`**: versão `v15`. Estratégia: `_next/static` NetworkFirst, navegação NetworkOnly
- **Coolify no VPS**: instalado mas **não gerencia deploys**. Deploy manual via GitHub Actions SSH
- **Next.js 16 `next.config.ts`**: `reactCompiler: true` em root (não `experimental`). `typedRoutes` quebra build com BottomNav strings. `headers()` com `source: "/:path*"` funciona (sintaxe simples); `headers()` com regex `/icon-:size*` quebra Turbopack
- **Security headers** (2026-06-19): HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy configurados via `headers()` em `next.config.ts`
- **Escaping de caracteres no write tool**: `\u00cd` e outros escapes Unicode podem aparecer em vez de caracteres acentuados ao usar o `write` tool. Sempre revisar arquivos escritos e corrigir acentos manualmente

## Webhooks (2026-06-19)
- **3 webhooks**: `email-to-task`, `csv-from-bank`, `deploy-status` — cada um com seu próprio secret HMAC
- HMAC centralizado em `src/lib/webhooks/hmac.ts` com `crypto.timingSafeEqual` (constant-time comparison)
- **Idempotência**: tabela `webhook_event` com unique constraint `(source, event_key)`. Cada webhook verifica replay antes de processar
- **Secrets separados**: `EMAIL_SECRET`, `CSV_SECRET`, `DEPLOY_SECRET` (com fallback para `WEBHOOK_SECRET` legado)
- **Payload schemas**: `email-to-task` aceita `message_id`, `csv-from-bank` aceita `import_id`, `deploy-status` aceita `run_id` para event keys explícitos

## MCP Server (2026-06-19)
- **Endpoint**: `/api/mcp` (Streamable HTTP, spec 2025-06-18)
- **Auth**: Bearer token (`ops_...`) validado contra `agent_token` table
- **35 tools**: tasks, finance, health, notes, meals, habits, projects, budget, calendar, reports, dashboard, semantic search
- **Rate limiting**: 120 req/min por IP, bloqueio 60s. Cleanup automático a cada 5min via `setInterval`
- **Audit log**: tabela `mcp_audit_log` registra toda tool call com `tool_name`, `success`, `duration_ms`, `args`
- **API timeout**: `agentApi` usa `AbortController` com 30s timeout (`MCP_API_TIMEOUT_MS` env override)
- **stdio proxy** (`mcp-server/src/index.ts`): conecta ao remote `/api/mcp` via StreamableHTTP, expõe tools via stdio. Reconexao exponencial (5 retries) + retry em tool calls com erro de transporte
- **Type safety**: schemas Zod passados direto ao `registerTool` (SDK suporta Zod v3/v4 nativamente via `zod-json-schema-compat`)
- **Docs**: `docs/openclaw-mcp.md` (remote HTTP), `docs/claude-hermes-mcp.md` (stdio proxy)

## Semantic Search (2026-06-19)
- **Ollama** (`nomic-embed-text`) + **Qdrant** self-hosted
- `syncNoteEmbedding(noteId)` é server action em `src/lib/actions/semantic-search.ts`
- **Chamada em**: `useCreateNote.onSettled`, `useUpdateNote.onSettled`, `useDeleteNote.onSettled` (delete via `deleteNoteEmbedding`)
- **Fire-and-forget**: `.catch(() => null)` — falhas não bloqueiam a UI
- Busca via `semanticSearchNotes(query, limit)` → embed query → Qdrant search → fetch full notes from Supabase

## Data Safety (2026-06-19)
- **Reports query bounded**: `useReports(period)` filtra por data no DB (30/90/365 dias). Tasks limit 500, transactions limit 1000, habit entries limit 1000. `period="all"` não filtra mas ainda limita
- **CSV import Zod validation**: cada row do CSV é validada contra `transactionSchema` antes de inserir no DB. Rows inválidas são silenciadas
- **Export/Import FK sanitization**: import stripa FKs cross-tabela para evitar dangling references ao importar dados de outro usuário
- **JSON column validators**: `parseAttachments` (notes), `parseWeightValue`/`parseBloodPressureValue`/`parseGlucoseValue`/`parseHealthLogValue` (health_log.value) — substituem casts `as Type`

## Component Patterns (2026-06-19)
- **`React.memo`**: `NoteRow` envolvido em `memo()` — previne re-render quando parent re-renderiza sem mudar props
- **`useReducer`**: `EditTaskDialog` usa 1 `useReducer` (12 campos de formulário) em vez de 12 `useState`
- **Grouped state objects**: `YearView` (dialog state) e `SettingsPage` (token UI state) usam 1 `useState` agrupado em vez de múltiplos independentes
- **Lazy queries**: `useProjects({ enabled })` e `useUpcomingEvents(limit, { enabled })` aceitam option `enabled` para deferring. Dashboard usa `deferredReady` state para adiar queries below-the-fold

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
| **3 — Intelligence** | Semantic search (pgvector) + Webhooks for input/output | High | pgvector on Supabase |

### Implementation Notes
- **Frontmatter**: Parse `---\nkey: value\n---` from top of `content` column; no schema migration needed for metadata
- **PARA**: Add `para` column (ENUM) or reuse `tags` with reserved prefix `#para-projects` etc. Migration `0025_note_para.sql`
- **Daily Notes**: Query by title pattern `YYYY-MM-DD` OR add `daily_date` column; link from calendar
- **Bidirectional links**: Regex `\[\[(.*?)\]\]` in content; use `title` as temporary key (no slugs yet); backlinks via `content LIKE '%[[title]]%'`
- **Inline tasks**: Detect `- [ ]` / `- [x]` in content; sync creates/updates tasks via `linked_note_id` on task table
- **Semantic search**: Requires `pgvector` extension + `embedding` column; generate via OpenAI API on insert/update

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
