@AGENTS.md

# Session Learnings — Suganuma Ops Hub

## 2026-06-03 — Notes Module Evolution

### Context
Session focused on evolving the notes module from a basic CRUD list into a knowledge management system that connects tasks, calendar, and ideas.

### Current Discovery
- Notes module is a solid production-ready foundation with:
  - Full CRUD via TanStack Query with optimistic updates
  - Realtime sync via Supabase Postgres Changes
  - Tag-based filtering and client-side search
  - Bidirectional task integration (`linked_task_id`)
  - Basic markdown rendering via `react-markdown` (lazy-loaded, SSR false)
  - Pinning system with CommandPalette integration
  - Undo toast on delete
  - 5 passing unit tests
- **Key gaps identified**:
  - No note detail page (`/notes/[id]`) — CommandPalette links to list only
  - No GFM support (tables, task lists, strikethrough) — `remark-gfm` removed
  - No server-side search or global note search from any page
  - No archive/trash system (delete is permanent, undo toast only)
  - No calendar tie-in or daily notes
  - No rich editor (toolbar, preview, split-pane)

### Proposed Evolution (3 Phases)

| Phase | Features | Complexity |
|---|---|---|
| **1 — Foundation** | PARA categorization (`projects`, `areas`, `resources`, `archive`) + Frontmatter YAML parser + Daily Notes | Low |
| **2 — Connectivity** | Bidirectional links `[[Note]]` + Inline tasks `- [ ]` sync with task module | Medium |
| **3 — Intelligence** | Semantic search (pgvector) + Webhooks for external input/output | High |

### Key Technical Decisions
- **PARA categorization**: Add `para` column (ENUM) to `note` table. Migration `0025_note_para.sql`. Alternative: use reserved tags `#para-projects` etc. (no migration, less strict)
- **Frontmatter YAML**: Parse `---\nkey: value\n---` from top of `content` column. No schema migration needed for metadata. Extract on read, inject on save.
- **Daily Notes**: Query by title pattern `YYYY-MM-DD` OR add `daily_date` column. Quick-create from calendar with auto-title.
- **Bidirectional links**: Regex `\[\[(.*?)\]\]` in content. Use `title` as temporary backlink key (no slugs yet) — normalize for comparison. Backlinks query: `content LIKE '%[[title]]%'`. Autocomplete on `[[` typing.
- **Inline tasks**: Detect `- [ ]` / `- [x]` in content. Sync creates/updates tasks via new `linked_note_id` on `task` table (reverse of existing `linked_task_id`). Bidirectional sync: marking done in note updates task, completing task updates note checkbox.
- **Semantic search**: Requires `pgvector` extension on Supabase + `embedding` column on `note`. Generate via OpenAI API on insert/update. pgvector is available on Supabase free tier (up to 5GB).

### What Was Not Proposed
- Full Obsidian-style graph view (too complex for current architecture)
- Real-time collaborative editing (single owner RLS only; major rewrite)
- Plugin system (overkill for single-user app)
- Mobile-specific note capture (app is PWA, web-based input is sufficient)

---

## 2026-06-02 — Production Deploy Recovery

### Problem
Deploy broke after `themeColor` added to `metadata` in `layout.tsx` and duplicate `useAnnualTasks` appeared in `annual.ts`. Build passed but Caddy was serving stale config. `ops.suganuma.com.br` returned 502.

### Root Causes
1. `themeColor` inside `metadata: Metadata` object triggers Next.js 16 production warnings (not errors, but noise)
2. Duplicate function `useAnnualTasks` in same file caused build failure
3. `headers()` in `next.config.ts` with path-to-regexp syntax (`/icon-:size*`) crashed Turbopack build — had been removed earlier but attempted re-addition
4. Caddy proxy had stale upstream container mapping after Coolify renamed container

### Fix Sequence
1. Removed duplicate `useAnnualTasks` — kept original at line 76
2. Moved `themeColor: "#121212"` from `metadata` to separate `export const viewport` object
3. Confirmed `headers()` is NOT in `next.config.ts` (removed permanently)
4. SSH to VPS, ran `caddy reload --config /etc/caddy/Caddyfile` to pick up new container
5. Verified `wget http://suganuma-ops-hub:3000/sw.js` returns `ops-hub-v7` from container
6. `ops.suganuma.com.br` confirmed online

### Lessons
- `themeColor` → `viewport` export (Next.js 16 convention)
- Duplicate function definitions = instant build failure (Turbopack/SWC is strict)
- `path-to-regexp` in `headers()` = Turbopack crash. Never use.
- Caddy `docker run --watch` does NOT auto-reload Caddyfile on container changes. Explicit `caddy reload` required.
- Service Worker version bump (`ops-hub-v7`) is the canonical cache-bust strategy.

---

## 2026-05-20 — Performance Optimization

### Changes Applied
- **`refetchOnWindowFocus: false`** global (Supabase realtime makes it redundant)
- **`staleTime` per query**: Infinity (budget, pregnancy), 5min (projects), 30s (tasks), default 60s (notes, meals, habits, calendar)
- **`gcTime: 5 * 60_000`** global
- **Lazy-loading** applied to: CommandPalette, RevenueChart, CSVImportDialog, ReactMarkdown, HealthTrends (-384 KB), EditTaskDialog (-15 KB), SelectiveImportDialog (-74 KB)
- **Removed 9 `loading.tsx`** files (app is 100% client-side, RSC not used)
- **Removed `remark-gfm`** (94 packages less, zero usage)
- **Removed `--font-geist-mono`** (never imported)

### Results
| Rota | Tamanho | vs antes |
|---|---|---|
| /health | 935 KB | -29% |
| /settings | 835 KB | -10% |
| /tasks | 943 KB | -4% |
| /dashboard | 890 KB | -2% |
| /finance | 954 KB | -2% |
| /login | 743 KB | -2% |
| /reports | 844 KB | agora com cache TanStack |

### Build
- Local: ~4.5s (`SKIP_TSC=1`)
- VPS: ~60s (Docker build)

---

## 2026-05-20 — GitHub Actions Workflow Simplification

### Problem
Job `typecheck` paralelo nunca completava no Actions runner (OOM/CPU timeout com ~70 arquivos TS strict mode).

### Solution
- Workflow reduzido para **1 job único** (sem typecheck)
- `tsc --noEmit` nunca passou no CI. Type checking via VSCode local.
- Deploy usa `SKIP_TSC=1` permanente.
- `tsconfig.json`: sem plugin `"next"`, `include` estreito `["src/**/*.ts", "src/**/*.tsx"]`.

### Deploy Pipeline
1. SSH no VPS (`appleboy/ssh-action@v1`)
2. `git clone --depth 1`
3. `echo` vars no `.env.prod` (sem heredoc)
4. Detecta rede do `caddy_proxy` via `{{json}}`+Python
5. `docker build --build-arg ... -t ops-hub:latest .`
6. Para container antigo, remove anterior
7. `docker run -d --name suganuma-ops-hub --network $NET --env-file .env.prod --restart unless-stopped ops-hub:latest`
8. `~/update-ops-proxy.sh` se existir
9. Verifica `sw.js` contém `"v7"` (sinal de deploy bem-sucedido)

### Anti-patterns Documented
- NUNCA usar `python3 -c "..."` com aspas duplas em YAML `script: |`
- NUNCA usar template Go com `$` inline em shell (`docker inspect --format`)
- NUNCA usar `set -e` no início do script deploy — esconde erros
- `command_timeout`: usar `40m` (docker build no VPS: 5-15 minutos)
- Variáveis: exportar secrets como env vars antes do heredoc, acessar via `$FOO` dentro de heredoc quoted

---

## 2026-05-10 — Dockerfile & SW Refinement

### Dockerfile Rules
- Base: `node:22-alpine`
- `ARG` + `ENV` para `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no stage `builder`
- `output: "standalone"` → copiar `.next/standalone` e `.next/static`
- user `nextjs` (gid 1001)
- HEALTHCHECK: `node -e "http.get('http://127.0.0.1:3000/sw.js', ...)"` — start-period=40s. Sem curl no Alpine minimal.

### Service Worker Strategy
- **Navegação HTML**: NetworkOnly (NUNCA cachear). Middleware retorna 307 para `/login` quando não autenticado — cachear corrompe experiência.
- **Assets Next.js** (`_next/static/`): CacheFirst (imutáveis, status 200 only)
- **Outros assets**: StaleWhileRevalidate com validação status 200
- Cache bucket versionado: `"ops-hub-v7"` (incrementar a cada mudança estrutural)

---

## Cumulative Deploy Status

| Date | Commit | Status | SW Version |
|---|---|---|---|
| 2026-06-02 | `7411d3f` | ✅ Green (themeColor fix) | v7 |
| 2026-06-02 | `da6a9ef` | ✅ Green (deploy restored) | v7 |
| 2026-05-20 | (vários) | ✅ 10 deploys verdes (#149-#158) | v5 |

**App is ONLINE**: `ops.suganuma.com.br` serving `ops-hub-v7` from `suganuma-ops-hub` container on `coolify` network (`10.0.2.4`).
