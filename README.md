# Suganuma Ops Hub

Personal command center — gestão integrada de tasks, finanças, saúde, notas, refeições, hábitos e calendário.

## Stack

- **Next.js** 16.2.4 · **React** 19.2.4 · **TypeScript** ^5
- **Tailwind CSS** v4 com `@theme inline` e tokens customizados
- **Supabase** (Postgres + Auth + Realtime)
- **TanStack Query** v5 com `staleTime: 60s` / `gcTime: 5min`
- **Zod** v4 para validação de schemas
- **Recharts** para gráficos de tendências
- **Serwist** para PWA (service worker manual)

## Arquitetura

Cada módulo segue o pipeline:

```
Migration SQL → Zod Schema → Database Types → TanStack Queries → Components → Page
```

| Camada | Local | Responsabilidade |
|--------|-------|------------------|
| Migration | `supabase/migrations/XXXX_nome.sql` | DDL + RLS + índices + realtime pub |
| Schema | `src/lib/schemas/nome.ts` | Validação Zod + tipos exportados |
| Types | `src/lib/database.types.ts` | Tipos Row/Insert/Update do Supabase |
| Queries | `src/lib/queries/nome.ts` | Hooks useQuery / useMutation |
| Components | `src/components/nome/` | UI reutilizável |
| Page | `src/app/(app)/nome/page.tsx` | Server ou client component |

## Estrutura de diretórios

```
supabase/migrations/         # 10 migrations (task, finance, health, notes, meals, habits...)
src/
  app/
    (app)/                   # Rotas protegidas (dashboard, tasks, finance, health, ...)
    api/agent/               # API routes para MCP Server
    globals.css              # Tailwind v4 + tokens customizados
  components/
    shell/                   # AppShell, Sidebar, BottomNav, TopBar, CommandPalette
    nome/                    # Componentes por domínio
  lib/
    schemas/                 # Zod schemas (task, finance, health, meal, note, habit)
    queries/                 # TanStack Query hooks
    supabase/                # Client (browser), Server (async), Service (admin)
    realtime.ts              # useRealtimeTable para sincronização cross-tab
    export-import.ts         # Export JSON completo + import batch
    useTitle.ts              # Hook para document.title dinâmico
  components/
    SectionErrorBoundary.tsx   # Boundary com retry em todas as páginas
    UndoToast.tsx              # Toast global com botão DESFAZER
    VirtualizedList.tsx        # Wrapper @tanstack/react-virtual
```

## Como rodar localmente

1. **Pré-requisitos**
   - Node.js 20+ (projeto usa v20 em dev; build roda em Docker `node:20-alpine`)
   - Conta Supabase com projeto linked

2. **Variáveis de ambiente**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<id>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
   ```

3. **Instalar e rodar**
   ```bash
   npm install
   npm run dev
   ```

4. **Supabase CLI (opcional)**
   ```bash
   npx supabase link
   npx supabase db push          # aplica migrations
   npm run types:supabase        # regenera database.types.ts
   ```

## Testes

```bash
npm test        # vitest --no-watch
```

`tests/schemas.test.ts` valida todos os Zod schemas (task, transaction, account, healthLog, pregnancy, appointment, protocol, protocolEntry, meal, mealPlan, note, habitTrack, habitEntry).

## Deploy

O projeto é containerizado com Docker e deployado em VPS próprio via GitHub Actions.

### Infraestrutura

- **VPS**: acessível via SSH (`secrets.VPS_HOST`, `secrets.VPS_USER`, `secrets.VPS_SSH_KEY`)
- **Proxy**: Caddy global na rede `coolify` (não gerenciado pelo compose)
- **Container**: `suganuma-ops-hub` com imagem `ops-hub:latest`

### Docker

```bash
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=... \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -t ops-hub:latest .
```

- `output: "standalone"` no next.config
- Node.js 20 Alpine, user `nextjs` (gid 1001)
- `images: { unoptimized: true }` necessário para standalone

### CI/CD

O workflow `.github/workflows/deploy.yml`:

1. SSH no VPS
2. `git clone --depth 1`
3. Gera `.env.prod`
4. Detecta rede do `caddy_proxy`
5. `docker build --build-arg ... -t ops-hub:latest .`
6. Substitui container antigo
7. Atualiza proxy Caddy

## MCP Server

MCP stdio server em `mcp-server/src/index.ts` para integração com Claude Desktop.

### Configuração no Claude Desktop

`~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "ops-hub": {
      "command": "node",
      "args": ["/caminho/para/mcp-server/dist/index.js"],
      "env": {
        "OPS_HUB_URL": "https://ops.suganuma.com.br",
        "OPS_HUB_TOKEN": "ops_..."
      }
    }
  }
}
```

### Tools disponíveis

| Tool | Descrição |
|------|-----------|
| `tasks_list` | Lista tasks com filtros |
| `tasks_create` | Cria task |
| `tasks_complete` | Marca task como done |
| `tasks_update` | Atualiza task |
| `finance_summary` | KPIs do mês |
| `finance_add_transaction` | Registra transação |
| `health_log_biometric` | Registra peso, pressão, glicose etc |
| `health_biometrics` | Histórico de medições |
| `health_create_appointment` | Agenda consulta |
| `health_list_appointments` | Lista consultas |
| `notes_list` / `notes_create` / `notes_update` / `notes_delete` | CRUD de notas |
| `meals_list` / `meals_create` / `meals_set_plan` | Refeições e plano semanal |
| `habits_list` / `habits_create` / `habits_log_entry` | Hábitos e entradas |
| `dashboard_get` | Snapshot consolidado cross-domain |

O token de agente é gerado em **Settings → Agent Tokens** dentro do app.

## Export / Import

**Settings → Exportar dados**: gera JSON com todas as tabelas do usuário.
**Importar dados**: faz INSERT batch com `owner_id` do usuário atual, substituindo registros existentes.

## PWA

- `src/app/manifest.ts` — app instalável (gerado pelo Next.js em `/manifest.webmanifest`)
- `public/sw.js` — Service Worker manual (serwist) v4
- Navegação: **NetworkOnly** (nunca cachear HTML)
- Assets Next.js (`_next/static/`): **CacheFirst**
- Outros assets: **StaleWhileRevalidate**

## Notas de desenvolvimento

- Todas as páginas em `(app)` são `"use client"`; títulos dinâmicos usam `useTitle()`.
- Dialogs usam `@base-ui/react` (prop `open` + `onOpenChange`).
- Checkboxes usam `checked` + `onCheckedChange`.
- Campos de DB (`owner_id`, `created_at`) não estão nos Zod schemas — adicionar no tipo da mutation quando necessário.
- Realtime via `useRealtimeTable` invalida queries automaticamente em insert/update/delete.
- Logger customizado: `logger.info(ctx, msg, data?)` / `warn` / `error` em `@/lib/logger`.

## Licença

MIT
