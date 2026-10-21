<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Stack — versões exatas (não assuma defaults de treino)
- Next.js **16.4.2** | React **19.2.6** | Zod **4.3.6** | Tailwind **v4**
- UI primitives: `@base-ui/react` (Dialog, Checkbox, Button) — **NÃO é Radix UI**
- Tokens CSS: `--color-bg`, `--color-surface`, `--color-teal`, `--color-amber`, `--color-danger`, `--color-health`, `--color-on-surface` via `@theme inline` no globals.css
- **Token de marca = `--brand` / `--brand-hi`** (NUNCA `--accent`): o shadcn declara `--accent` em `:root`/`.dark` **fora de @layer** e, em CSS, não-layerado vence layerado → o teal do projeto era sobrescrito pelo cinza do shadcn e o app inteiro saía monocromático. `@theme inline` não emite `--color-*`: as utilities inlineiam o valor, então `theme.ts` escreve `--brand`/`--brand-hi` (inline style) e o seletor de acento funciona
- Tema customizável: `--brand` / `--brand-hi` (5 opções: teal, blue, green, purple, orange) via `src/lib/theme.ts`
- **Provar token ≠ ler código**: extrair `.next/static/chunks/*.css` do container e medir `getComputedStyle` no Chrome. O fonte mente; o CSS compilado não

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
| Budget | (dashboard) | 0016, 0042 | `budget.ts` | (BudgetCard e CategoryBudgets no Dashboard) | 8 |
| Baby | `/baby` | 0041 | `baby.ts` | `baby/page.tsx` | 69 |
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
- **Tags** (`0015_tags.sql`): coluna `tags text[]` na task. Exibidas como pills `#tag` no TaskRow. Filtro por tag na TasksPage (chips, e o filtro vive na URL)
- **Filtros da TasksPage vivem na URL** (`?project= ?cat= ?tag= ?search=?sort=`): sobrevivem a reload, ficam linkáveis e voltam no botão "voltar". Busca é estado local com sync debounced (400ms) para a URL; os demais filtros escrevem na URL direto (`router.replace`)
- **Ordenação** (`?sort=`): `due` (padrão, preserva a ordem do servidor: prazo, sem prazo no fim), `priority`, `important`, `created`. A regra é pura e testada (`src/lib/task-sort.ts`)
- **Revisão semanal** (`/review`): o card **CHECKLIST DA SEMANA** traz as 4 decisões do ritual com o estado (inbox zerado, sem atrasadas, áreas revisadas, delegadas com retorno) e um contador `2/4 OK` — o resto da página é o *resumo* da semana. A regra é pura (`src/lib/weekly-review.ts`)
- **Energy level** (`0034_task_energy_level.sql`): coluna `energy_level` (low/med/high). Badge no TaskRow: DEEP (high/purple), MED (med/neutral), QUICK (low/teal). EditTaskDialog tem seletor toggle
- **Notas vinculadas**: tasks podem ter notas vinculadas (`linked_task_id` em note, FK com `on delete set null`). EditTaskDialog mostra lista de notas vinculadas
- **Matriz de Eisenhower**: Dashboard exibe quadrantes (Urg+Imp / Imp+NãoUrg / Urg+NãoImp / NemUrgNemImp) filtrados por `important` e `priority`/`due_at`

### Cockpit (2026-10-20)
- **FOCO** é a fila do dia: tasks pendentes ranqueadas por **tier** com **motivo visível** — `atrasado Nd` > `vence hoje` > `urgente` > `importante` > `quick win` (energia baixa). Substituiu os cards URGENTES/ATRASADAS/QUICK WINS, que mostravam a mesma task em 2-3 lugares sem ranking. Blocos: Bebê → FOCO → Inbox → Consultas/Eventos → resumo
- **Motivo > cor**: o chip do motivo (danger/amber/teal) diz *por que* o item está na fila — contagem sozinha não ajuda a decidir
- Itens do FOCO são clicáveis (`/tasks?search=<título>`) e a data de vencimento é comparada no fuso de São Paulo (`dateStr`)

### Baby (2026-10-13, pós-parto)
- **Rota `/baby`**: registro de 1 toque (mamada E/D, mamadeira ml, xixi/cocô, sono, vitamina D), resumo de 24h, timeline do dia (edita horário / exclui com desfazer), crescimento e painel "quando procurar ajuda". Widget compacto no Cockpit; card na Saúde e StatCard no Dashboard substituem o modo gravidez quando há `child`
- **Lógica pura em `src/lib/baby/`** (testada em node): `dates.ts` (aritmética YYYY-MM-DD e fuso SP), `summary.ts` (`ageLabel`, `summarize24h`), `quick-log.ts` (payloads e formatação), `care-schedule.ts` (cronograma), `agent.ts` (`normalizeAgentLog`), `server.ts` (só rotas de agente)
- **Cronograma = tasks comuns** num projeto "Bebê — nome" (`child.project_id`), com tags `bebe` + grupo (`triagem`, `consulta`, `vacina`, `documento`, `mae`, `compras`). Por isso aparece sozinho no Cockpit, Calendário, push e MCP. O seed (`CARE_ITEMS`) é ponto de partida: vacinas seguem o calendário particular SBIm 2026-27 e as versões do calendário divergem entre si — **revisar com o pediatra**
- **Agente/MCP**: `GET /api/agent/baby`, `GET|POST /api/agent/baby/logs`, tools `baby_summary`, `baby_log_event`, `baby_list_logs`; `get_daily_cockpit` ganha o bloco `baby`. O `child_id` é SEMPRE o do dono do token (service role bypassa RLS)
- **Armadilhas**: `Omit<>` em união discriminada (`BabyLog`) colapsa os tipos — receber `BabyLog` inteiro; `z.string().datetime()` exige `Z` (usar `toISOString()`); `datetime-local` é horário de SP, converter com `toLocalInput`/`fromLocalInput`

### Captura (2026-10-20)
- **Web Share Target** (`share_target` no `src/app/manifest.ts` → `POST /api/capture`): compartilhar texto/link de qualquer app do iPhone para o Ops Hub (PWA instalada) grava direto no `inbox_item` do dono. É o caminho de captura mais curto no celular (1 toque, sem abrir o app). Sem sessão → 303 para `/login`; corpo vazio → `?captured=empty`; erro de insert → `?captured=erro`; sucesso → `?captured=1` (banner de confirmação na tela do Inbox)
- **`source` do item = `manual`**: o check constraint de `inbox_item.source` não aceita `share` (aceita manual/telegram/audio/email/webhook/mcp/raindrop)
- **O SW não intercepta `/api/*`** (early return no `fetch` handler) — o POST do share target chega íntegro na rota
- **Inbox em FIFO**: `created_at` ASC — o item mais antigo fica no topo, porque o Inbox é fila de *triagem* (o que chegou antes é o que espera mais). Antes era DESC, que punia o item mais antigo
- **Adiar (snooze, migration 0043)**: coluna `snoozed_until` (date) — o item sai da fila e volta sozinho na data escolhida (AMANHÃ/3 DIAS/SEMANA/MÊS). A fila esconde os adiados (`or=snoozed_until.is.null,snoozed_until.lte.<hoje>`) e a aba TODOS mostra a etiqueta `ATÉ dd/mm`. Rotas de agente seguem a mesma regra
- **Aditar NÃO arquiva**: antes a fila só tinha duas saídas (fazer/descartar) e o que não era para hoje acabava arquivado — ou seja, perdido
- Testes: `tests/capture-route.test.ts` (5 casos: sem sessão, gravar, title sem text, body vazio, erro de insert)

### Notes
- **Converter nota em task**: botão `→TASK` no NoteRow (modo leitura). Cria task com título+conteúdo da nota e vincula automaticamente via `linked_task_id`
- **Filtros na URL** (`?ctx= ?tag= ?prefix= ?para= ?search=`): sobrevivem a reload, ficam linkáveis e voltam no botão "voltar". `tag` e `prefix` são **mutuamente exclusivos** e vão num único update (dois updates em sequência usariam a mesma URL base e o segundo apagaria o primeiro)
- **Regra do filtro é pura** (`src/lib/notes-filter.ts`, testada em node): o grupo de prefixo `"#"` reúne as tags **sem barra** — o matcher antigo procurava `"#/"` e o filtro `#geral` não encontrava nada
- **Bulk em lote** (`useBulkUpdateNotes` / `useBulkDeleteNotes`): N updates no banco + **1 sync de embedding** (1 embed no Ollama + 1 PUT no Qdrant). Antes eram N syncs — N embeddings e N PUTs por operação de lote

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
- Exporta **25 tabelas** (`TABLES` em `export-import.ts`): as 17 originais + módulo people (5) + **child, baby_log, budget_category**. `child` e `baby_log` preservam `id` (FK intra-módulo); `child.project_id` é zerado no restore (o id do projeto muda), então o botão "Gerar cronograma" reaparece — não gerar de novo se as tasks do bebê já existirem
- **Export com paginação** (2026-08-29): `.range()` em páginas de 1000 — sem isso, self-hosted Supabase trunca tabelas >1000 rows **silenciosamente no único backup**
- **Import em chunks de 500** (2026-08-29): insert completo estourava body limit do PostgREST em tabelas grandes; erro por chunk logado, chunk seguinte tenta
- Import total: substitui `owner_id` pelo usuário atual, stripa `id`/`created_at`/`updated_at`, **stripa FKs cross-tabela** (`project_id`, `linked_task_id`, `account_id`, `meal_id`, `habit_id`, `protocol_id`, `pregnancy_id`, `series_id`) para evitar dangling references
- Import em ordem parent-first (`IMPORT_ORDER` exportado — reutilizado pelo diálogo seletivo)
- Export version: `0.4.0`
- **Import seletivo** (`src/components/settings/SelectiveImportDialog.tsx`): dialog que lista tabelas do JSON com contagem de linhas, permite selecionar quais importar — **sincronizado com importAllData** (mesmo `IMPORT_ORDER` parent-first + `FK_COLUMNS_TO_STRIP` + chunking + try/finally que não trava o `importing`)
- UI na página Settings com 3 botões: Exportar backup, Importar seletivo, Importar tudo

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
- BottomNav mobile máximo 5 itens (DASH, **BEBÊ**, TASKS, FIN, HUB) — BEBÊ substituiu INBX em 2026-10-13 (nascimento). HUB menu: COCK, **INBX**, NOTES, PROJ, PPL, CAL, REV, HLTH, MEAL, HBT, REPS, SET
- `due_at` é `string | null` no DB mas `string | undefined` no Zod schema — usar `undefined` nos mutations
- **Realtime**: tabelas adicionadas à `supabase_realtime` publication: task, account, transaction, note, meal, meal_plan, habit_track, habit_entry, project, budget, appointment, health_log, pregnancy, protocol, protocol_entry, annual_event, **inbox_item**, **child, baby_log, budget_category**
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
- **Migration 0041**: `child` + `baby_log` — módulo Bebê (RLS por owner, realtime idempotente). **Aplicar no VPS antes do deploy**
- **Migration 0042**: `budget_category` — meta mensal por categoria, unicidade por `category_key` normalizada. **Aplicar no VPS antes do deploy**
- **Migration 0037**: `'raindrop'` no check de `inbox_item.source` — ponte Raindrop → Hub (aplicada no VPS via `docker exec` psql, ver lição 2026-08-27)
- **`queryOptions` API TanStack v5**: Todas as queries exportam `queryOptions`. `staleTime` e `gcTime` configurados por query (ver seção Performance). `refetchOnWindowFocus: false` global
- **`sw.js`**: versão `v18` (o deploy lê a versão do próprio arquivo). Estratégia: `_next/static` NetworkFirst, navegação NetworkOnly. Sem background sync (removido placeholder no-op)
- **Next.js 16 `next.config.ts`**: `reactCompiler: true` em root (não `experimental`). `typedRoutes` quebra build com BottomNav strings. `headers()` com `source: "/:path*"` funciona (sintaxe simples); `headers()` com regex `/icon-:size*` quebra Turbopack
- **Security headers** (2026-06-19): HSTS, CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy configurados via `headers()` em `next.config.ts`
- **Escaping de caracteres no write tool**: `\u00cd` e outros escapes Unicode podem aparecer em vez de caracteres acentuados ao usar o `write` tool. Sempre revisar arquivos escritos e corrigir acentos manualmente

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

## Referências sob demanda (NÃO carregadas automaticamente — ler antes de mexer na área)
- `docs/ref-deploy.md` — VPS, Caddy, Dockerfile, SW, deploy.yml, secrets, tabela de lições de deploy
- `docs/ref-integrations.md` — timeouts, Qdrant, webhooks, Web Push, Raindrop, Embeddings, MCP, Inbox, Ollama, Hybrid RAG
- `docs/ref-testing-performance.md` — Vitest, gate de testes, TanStack/code-splitting/bundle
- `docs/ref-notes.md` — estado atual e roadmap do módulo Notes
- `docs/session-history.md` — histórico de sessões

### Regras críticas de deploy (resumo; detalhes em ref-deploy.md)
- Só um `middleware.ts` (em `src/`); sem regex negativo no matcher; `headers()` só com `source: "/:path*"`.
- Caddy upstream SEMPRE por nome (`suganuma-ops-hub:3000`), nunca IP; SW: navegação NetworkOnly, bump de versão a cada mudança estrutural.
- Build do deploy usa `SKIP_TSC=1`; rode `npm run build` com tsc ativo antes de deploys grandes. Nunca recriar job `typecheck` nem `loading.tsx`.
- Secrets do GitHub só entram no container no próximo deploy. Migrations via `docker exec -i supabase-db psql -U supabase_admin -d postgres`.
- Fetch externa: `fetchWithTimeout()`. Queries de tabelas grandes: paginar `.range()` de 1000. Testes: `npm test` (node); DOM só via `npm run test:docker`.
