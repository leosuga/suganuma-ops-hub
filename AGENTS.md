<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Stack — versões exatas (não assuma defaults de treino)
- Next.js **16.2.4** | React **19.2.4** | Zod **4.3.6** | Tailwind **v4**
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
4. **Queries TanStack** (`src/lib/queries/nome.ts`) — hooks `useQuery`/`useMutation` com optimistic updates onde cabível
5. **Componentes** (`src/components/nome/`) — reutilizáveis, seguindo o design system do projeto
6. **Página** (`src/app/(app)/nome/page.tsx`) — server ou client component com `SectionErrorBoundary`
7. **Navegação** — adicionar em: Sidebar, BottomNav (mobile, máx 5 itens), TopBar, CommandPalette

## Domínios (28 rotas)

| Módulo | Rota | Migration | Queries | Página | Testes |
|--------|------|-----------|---------|--------|--------|
| Dashboard | `/dashboard` | — | tasks+finance+health+meals+notes | `dashboard/page.tsx` | — |
| Tasks | `/tasks` | 0001 | `tasks.ts` | `tasks/page.tsx` | 7 |
| Finance | `/finance` | 0002 | `finance.ts` | `finance/page.tsx` | 6 |
| Health | `/health` | 0003 | `health.ts` | `health/page.tsx` | 13 |
| Calendar | `/calendar` | — | `calendar.ts` | `calendar/page.tsx` | — |
| Notes | `/notes` | 0007 | `notes.ts` | `notes/page.tsx` | 5 |
| Meals | `/meals` | 0008 | `meals.ts` | `meals/page.tsx` | 5 |
| Habits | `/habits` | 0009 | `habits.ts` | `habits/page.tsx` | 8 |
| Settings | `/settings` | — | — | `settings/page.tsx` | — |

Schemas testados: `tests/schemas.test.ts` (27 testes Zod)

## Componentes compartilhados
- **`SectionErrorBoundary`** (`src/components/SectionErrorBoundary.tsx`) — class component com retry, envolve todas as páginas
- **`UndoToast`** (`src/components/UndoToast.tsx`) — provider global no AppShell, toast com botão DESFAZER (5s timeout). Todos os deletes (task, transaction, note, meal, habit) disparam `toast.show()` com snapshot para `onUndo`
- **`VirtualizedList`** (`src/components/VirtualizedList.tsx`) — wrapper `@tanstack/react-virtual`, ativa com >50 itens. TasksPage e TransactionTable já usam
- **`CommandPalette`** (`src/components/shell/CommandPalette.tsx`) — `Cmd+K` global, navegação + busca de tasks/transações/appointments do cache

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

## Export/Import
- `exportAllData()` / `importAllData(json)` em `src/lib/export-import.ts`
- Exporta todas as tabelas do usuário como JSON → download via Blob
- Import faz INSERT batch com `owner_id` do usuário atual
- UI na página Settings

## Deploy
- Coolify UUID: `sw2ag8vuujt87zk04wwbxsvg`
- Após redeploy, rodar `~/update-ops-proxy.sh` no VPS (IP do container muda)
- Push para `main` dispara GitHub Actions `deploy.yml`: SSH no VPS → trigger Coolify (localhost:9000) → aguarda finalizar → update proxy → health check
- CI (`ci.yml`) roda em PRs: type check + build + `npx vitest run`
- Webhook de status: `POST /api/webhooks/deploy-status` com HMAC, notifica start/success/failure (Telegram opcional)
- Health check: `GET /api/health` → `{"status":"ok","db":"ok","version":"0.1.0"}`
- PWA: service worker (`public/sw.js`), manifest, precache de todas as rotas, cache strategy: API=network, navegação=networkFirst, assets=staleWhileRevalidate

## Dependências notáveis
- `@base-ui/react` — Dialog, Checkbox, Button (NÃO Radix)
- `@tanstack/react-query` + devtools
- `@tanstack/react-virtual` — virtualização de listas (>50 itens)
- `recharts` — gráficos (RevenueChart, WeightChart, BloodPressureChart)
- `react-markdown` + `remark-gfm` — renderização de markdown nas notas
- `papaparse` — import CSV de extratos bancários
- `cmdk` — command palette
- `next-themes` — dark/light mode
- `@serwist/next` + `serwist` — PWA (instalado, sw.js manual)
- `lucide-react` — ícones (não usado diretamente, svg inline nos componentes de shell)

## Pontos de atenção
- `@tailwindcss/typography` NÃO está instalado — classes `prose`/`prose-invert` no Notes podem não funcionar como esperado Tailwind v4
- ESLint tem dependência corrompida (`debug` module) — é problema preexistente de `node_modules`, não do código. Ignorar falha no lint local; CI roda `tsc --noEmit` + `npm run build` como verificações reais
- Node.js v25.6.0 — vitest 4.1.5 funciona mas pode ter instabilidades. Usar sempre `--no-watch` para evitar hangs
- BottomNav mobile máximo 5 itens (DASH, CAL, TASKS, FIN, HUB). Notes, Meals, Habits acessíveis via Sidebar (desktop) ou CommandPalette
- `due_at` é `string | null` no DB mas `string | undefined` no Zod schema — nos mutations usar `undefined` (não `null`) para evitar type errors
- Realtime: tabelas precisam ser adicionadas à `supabase_realtime` publication na migration SQL
- Light mode: `html.light` definido no globals.css com variáveis customizadas. O `--color-health` tem valor diferente no light mode (`#2E8B57`)
- MCP Server (`mcp-server/src/index.ts`) + SDK (`packages/ops-hub-sdk/`) para integração com Claude Desktop — requer token de agente gerado em Settings
