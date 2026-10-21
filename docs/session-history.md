# Histórico de sessões — Suganuma Ops Hub

Movido do CLAUDE.md para reduzir o contexto carregado em toda sessão. Consulte sob demanda.

# Session Learnings — Suganuma Ops Hub

## 2026-10-21 (tarde/noite) — Operação: build visível, suíte DOM no CI, filtros e ordem

### Entregue
- **Build/commit no ar**: `GIT_SHA` e `NEXT_PUBLIC_BUILD` como build-arg (Dockerfile + deploy.yml);
  `/api/health` devolve `build`; Settings > SISTEMA mostra a linha BUILD. Motivo: durante um deploy,
  `~/ops-hub` já está no commit novo enquanto o container ainda é o antigo — foi assim que um deploy
  antigo quase virou o estado final de produção.
- **Suíte DOM no CI** (step `Test (DOM)` via `Dockerfile.test`): ela só rodava na mão. Resultado
  imediato: a remoção de `useHabitEntries` (leva do N+1) tinha deixado **2 testes quebrados** e
  **nada no CI acusava**. `vitest.config.ts` passou a excluir `**/*.test.tsx` (qualquer teste DOM).
- **Filtros das Notas na URL** (`?ctx= ?tag= ?prefix= ?para= ?search=`) + **bug do `#geral`**
  (o grupo das tags sem barra procurava `"#/"` e não encontrava nada). Regra extraída para
  `src/lib/notes-filter.ts` (10 testes).
- **Ordenação de tasks** (`?sort=`): prazo (padrão) / prioridade / importante / criação. Regra pura
  (`src/lib/task-sort.ts`, 6 testes) — antes a lista ignorava prioridade, discordando do FOCO.
- **Hábitos**: as métricas foram para o FIM da lista — marcar o dia é a ação diária, o resumo é consulta.
- **Alvos de toque**: Finance 24→36px, Protocolos 20→32px (o glifo continua do mesmo tamanho, a
  densidade visual não muda).
- **Bulk de notas em lote**: 1 embed no Ollama + 1 PUT no Qdrant, em vez de N+N.

### Lições
- **Suíte que só roda na mão é suíte que quebra em silêncio**: 2 testes quebrados passaram pelo
  gate do CI porque ele rodava só o ambiente node.
- **`gh pr merge --delete-branch` mexe no repositório local** (checkout + apaga a branch): fazer o
  commit ANTES, senão alterações em voo somem junto com a branch.
- **Dois updates de URL em sequência usam a mesma base**: o segundo apaga o que o primeiro setou —
  filtros mutuamente exclusivos vão num único update.
- **Filtro por prefixo de tag**: o grupo `"#"` (tags sem barra) precisa de matcher próprio.

## 2026-10-20 — Auditoria de UI/UX: cor, foco, a11y, atalhos e captura em 1 toque

### Contexto
O app estava em produção com **toda a identidade cromática morta**: screenshot de `ops.suganuma.com.br/login`
mostrava o app inteiro em cinza (inclusive o CTA primário, cinza-sobre-cinza). A causa não era o
Tailwind nem o shadcn: era a **cascata de camadas** do CSS. A mesma sessão fechou o gap de
produtividade no celular: capturar uma ideia exigia abrir o app.

### Entregue
- **Cor**: tokens de marca renomeados para `--brand`/`--brand-hi` (sem colisão com o `--accent` do
  shadcn) e declarados no `@theme inline`; `theme.ts` passou a escrever `--brand`/`--brand-hi` — o
  seletor de acento em Settings **era no-op** (escrevia `--color-accent`, que nada lia).
- **Foco visível**: 46 inputs usavam `focus:outline-none focus:border-teal` → a borda de foco virava
  `#262626`, **mais escura** que a borda padrão. Agora têm `focus:ring-1`.
- **CommandPalette honesta**: as 19 teclas `<kbd>` exibidas **não tinham handler** (só Cmd+K e o
  j/k/t/n/a/i do Inbox existiam). Foram removidas e entrou uma legenda com os atalhos reais.
- **Grupo "Transações recentes"** (paleta) lia `financeKeys.transactions()` sem filtros — chave que
  nenhuma query popula, então o grupo **nunca aparecia**. Agora lê todas as queries com prefixo.
- **Métricas honestas**: "Concluídas" contava todo o histórico mas dizia "tasks hoje"; o rodapé do
  Cockpit mostrava contagem truncada (`slice(0,5)`); "Quick Wins" pegava `priority med` (o default).
  Agora: concluídas de hoje, contagem real, quick win = `energy_level low`.
- **Links que não filtravam**: `/notes?search=` (gerado por 3 pontos) era ignorado pela página — a
  busca agora lê o param e casa **tags** também. `/tasks?search=` idem, com títulos do Cockpit
  clicáveis. Filtro por tag do Tasks tinha estado+lógica **sem UI** — ganhou chips.
- **Toque no celular**: botões de triagem do Inbox/Cockpit saíram de 24px/8px para 32px/10px.
- `/` agora redireciona para `/dashboard` (igual ao `start_url` do manifest; antes caía em `/tasks`).
- **Contraste**: secundários de `text-on-surface/40` (3.24:1) e `/50` → `/60` (5.76:1) em 554+ usos;
  light mode re-ajustado para ≥4.5:1 (`accent-hi` era **1.7:1**, invisível). Piso tipográfico
  6-7px → 9px (37 pontos estavam abaixo do próprio piso do projeto).
- **Semântica**: `aria-current` + `nav` com `aria-label` na Sidebar, `aria-hidden` nos SVGs
  decorativos, `role="alert"` nos erros de form, `aria-label` nos botões só de ícone.
- **Web Share Target**: `share_target` no manifest → `POST /api/capture` grava direto no
  `inbox_item` do dono. Compartilhar texto/link de qualquer app do iPhone para o Ops Hub é
  captura em 1 toque, sem abrir o app. Banner de confirmação via `?captured=1`.
- **Inbox em FIFO** (`created_at` ASC): o item mais antigo fica no topo, porque o Inbox é fila de
  triagem — com DESC, o item mais antigo migrava para o fim e nunca era triado.
- **Cockpit → FOCO**: os cards URGENTES/ATRASADAS/QUICK WINS viraram uma fila única, ranqueada
  por tier e **com motivo visível** (`atrasado 3d`, `vence hoje`, `importante`, `quick win`).
  Antes a mesma task aparecia em 2-3 cards ao mesmo tempo; agora o Cockpit responde "o que
  fazer agora" em 5 blocos.
- **Filtros de Tasks na URL** (`?cat= ?tag= ?project= ?search=`): sobrevivem a reload, ficam
  linkáveis e voltam no "voltar". Antes categoria/tag/busca eram estado local e se perdiam a
  cada navegação.

### Decisões que ficaram
- **Não inflar tipografia**: a densidade 8-11px é identidade do projeto. O que se corrigiu foi
  contraste e alvo de toque, não tamanho de fonte. (O contraste de `text-on-surface/40` = 3.2:1 no
  dark / 2.4:1 no light segue abaixo de AA — pauta para a próxima leva.)
- **Sem atalhos de tecla única na palette**: a busca do cmdk digita no mesmo input, então "D"/"T"
  colidiria com digitar. Alternativas (chord no estilo Linear "G D") ficam para quando houver
  espaço para Teach/descobrir.
- **Filtro por prefixo no TanStack** (`getQueriesData`) para dados "de qualquer filtro" — a chave
  exata sem filtros nunca era populada.

### Lições
- **Não-layerado vence layerado**: o shadcn declara `--accent` em `:root`/`.dark` fora de
  `@layer base`; o teal do projeto vivia em `@layer base { html { --accent } }` → perdia sempre.
  `@theme inline` **não emite** `--color-*`: as utilities inlineiam o valor (`var(--accent)`).
- **Provar token de cor exige o CSS compilado + browser real**: `docker exec ... cat
  .next/static/chunks/*.css` + `getComputedStyle` no Chrome. Ler o fonte não revela a cascata.
- **Foco precisa de contraste contra a borda padrão**, não só "mudar de cor".
- **Atalho anunciado e não implementado é bug de confiança**: o usuário aprende a errar.
- **Rótulo de métrica errado é pior que métrica ausente**; e lista truncada com total no rodapé mente.
- **Fila de triagem é FIFO**: DESC punia o item mais antigo, que migrava para o fim da lista.
- **Share target usa `source='manual'`**: o check constraint de `inbox_item.source` não tem `share`.
- **Upgrade de Next 16.2.6 → 16.4.2** fecha o único *critical* do audit (RCE/SSRF/cache
  poisoning em Server Actions + disclosure de Server Function endpoints). `middleware.ts`
  continua suportado no 16.4.2 (só o aviso de deprecat para `proxy`) e o standalone traz
  `middleware-manifest.json` — a proteção de auth não regrediu.
- **`next/font/google` baixa a fonte NO BUILD** → o build vira dependente de rede. No Mac
  ele quebrava porque o `SSL_CERT_FILE` (CA da rede doméstica) derrubava o fetch do Google;
  no CI/VPS passaria **por acaso**. Com a Inter no repo (`next/font/local`) o build é
  hermético e ~1,4s mais rápido.
- `tsc --noEmit` rodou limpo (0 erros) nesta base — dá para usar local, apesar do build usar SKIP_TSC.

## 2026-10-13 — Pós-parto: módulo Bebê, push antecipado e orçamento por categoria

### Contexto
A filha nasceu em 06/10/2026. O app só tinha o modo gravidez (`PregnancyCard`, "Semana de
gestação" no Dashboard, template de enxoval). Implementado em fatias com TDD, um commit por
fatia no branch `claude/busy-cray-asieec`.

### Entregue
- **Bugs**: `/api/mcp` respondia 400 para sessão desconhecida (redeploy zera o Map em memória);
  a spec manda 404 para o cliente reabrir a sessão — foi isso que impediu o Claude de ler o Hub
  durante a análise. `parseGlucoseValue` lia `mgdl` mas o app grava `mg_dl`.
- **Módulo Bebê** (migration 0041, `/baby`, MCP): registro de 1 toque, resumo de 24h, crescimento,
  cronograma de ~50 itens gerado como tasks, widget no Cockpit, BEBÊ na BottomNav no lugar de INBX.
- **Push**: briefing diário avisa vence hoje/amanhã (backlog item 5) e falha o job em erro de query.
- **Orçamento por categoria** (migration 0042, backlog item 6).

### Decisões que ficaram
- **Cronograma como tasks comuns**, não tabela própria: herda Cockpit, Calendário, push, MCP e
  recorrência sem código novo. Vacinas seguem o SBIm 2026-27, que diverge entre versões — o seed é
  ponto de partida revisável, e o diálogo de geração mostra tudo antes de criar.
- **Só o dono registra** (sem conta da mãe): compartilhamento por família exigiria household no RLS.
- **Lógica fora dos componentes** (`src/lib/baby/`): os testes de DOM só rodam em Docker, então
  tudo que dá para testar em node (datas, resumo, payloads, cronograma) é função pura.

### Lições
- **Sessão MCP desconhecida = 404, não 400** (`classifySessionRequest`).
- **`Omit<>` em união discriminada colapsa** `kind`/`data`; receber o tipo inteiro.
- **`z.string().datetime()` exige `Z`**: converter com `toISOString()`, nunca `-03:00`.
- **Erro de query em job de briefing não pode virar "nada pendente"**: checar `.error` no `Promise.all`.
- **Restore zera `child.project_id`** (FK externa): o botão de gerar cronograma reaparece.
- O CLAUDE.md pede comparar `tsc` com baseline: nesta base o `tsc --noEmit` rodou limpo (0 erros).
  Os 5 erros de eslint em cockpit/reports/review e os 2 do `CommandPalette` já existiam.

### Pendente para o Leo
Aplicar as migrations 0041 e 0042 no VPS (`docker exec -i supabase-db psql -U supabase_admin -d
postgres`) ANTES do deploy; cadastrar a bebê em `/baby`; gerar e revisar o cronograma; confirmar
as vacinas com o pediatra. Prazos legais: certidão até ~21/10, plano de saúde até ~05/11.

## 2026-08-27 — Raindrop → Hub Notes (ponte de curadoria, Variante C)

### Contexto
Sessão implementou a ponte completa Raindrop → Hub (`docs/raindrop-hub-bridge.md`):
endpoint `/api/integrations/raindrop-sync`, client `src/lib/raindrop.ts`, helper
compartilhado `createNoteWithEmbedding()` (extraído de `/api/agent/notes`),
workflow cron `raindrop-sync.yml`, migration `0037` (aplicada no VPS), 4 secrets
via `gh` CLI, deploy 3x verde e validação ponta a ponta com dados reais (100
itens → 98 notas / 2 inbox) + varredura do backlog (~2.1k itens) em background.

### Decisões de arquitetura que ficaram
- **Variante C (híbrida)** em vez de nota-direta (plano original do doc) ou
  inbox-puro: classificador LLM decide por item — `reference` → nota
  (pesquisável de imediato via Hybrid RAG); `actionable` → Inbox (entra no
  Cockpit e no fluxo de triagem que já existia). O problema real era *revisão*,
  não ingestão — a variante A só moveria a pilha do Raindrop pro Notes.
- **Classificador com viés REFERENCE** — artigos/tutoriais/guias = nota.
  Empírico: viés actionable mandava 56% do backlog técnico pro inbox (~1.1k
  itens = pilha movida de novo). Recalibrado → 98/2. Regra geral: em volume,
  validar o ratio com 1 run pequeno antes de varrer o backlog (dedup impede
  reprocessar barato).
- **Fetch por collection-alvo individual** (N chamadas), nunca `collectionId=0`:
  collections pessoais grandes ("unread", ~3.8k itens) afogam o backlog técnico
  no fetch das páginas mais recentes.
- **Cursor via nota pinned** (`raindrop-sync-state`) + dedup via `webhook_event`
  (unique `(source, event_key)`) — zero migration além do check de `source`.
- **`createNoteWithEmbedding()`** centraliza insert + sync de embedding para
  qualquer chamador server-side (rota agent, integrações) — nota criada fora da
  UI NUNCA mais fica de fora do índice vetorial.
- **Nome da collection como tag automática** (slug: "Data Science" →
  `data-science`) — melhora organização/Busca semântica sem esforço do usuário.

### Lições operacionais (detalhes na tabela de lessons do AGENTS.md)
- **Migrations podem rodar via SSH** (Supabase self-hosted): `docker exec -i
  supabase-db psql -U supabase_admin -d postgres` — owner é `supabase_admin`,
  NÃO `postgres`. Fim da era "migration manual no SQL Editor".
- **`gh` CLI cobre o ciclo inteiro do Mac**: `gh secret set`, `gh workflow run`,
  `gh run watch`, e deploy via `git push origin feat/x:main` (fast-forward).
- **O doc original da ponte estava desatualizado**: a Raindrop API TEM filtro
  nativo de data (`search=created:>YYYY-MM-DD` via search operators) — pesquisei
  na doc oficial (developer.raindrop.io + repo raindropio/developer-site) antes
  de codar e corrigi a arquitetura (não paginar "para trás").
- **Secrets do GitHub entram no container só no próximo deploy** (confirmado de
  novo) — por isso a sequência certa: setar secrets ANTES do deploy.

### Estado final da sessão
Backlog em varredura (scripts/raindrop-sweep.sh em background, cap 100/run) —
cron semanal assume a partir de então (segunda 08:00 BRT). Fora do escopo v1
(documentado): reprocessar itens atualizados (`lastUpdate`), tabela dedicada
`integration_cursor`, re-taguear histórico em renomeação de collection.

## 2026-08-19 — OAuth 2.1 Connector + Auditoria Completa do Backlog

### Contexto
Sessão implementou o custom connector OAuth 2.1 para o claude.ai (`src/lib/oauth/`,
`/authorize`, `/api/oauth/*`, migration `0035_oauth.sql`) e depois trabalhou
`docs/backlog-2026-08.md` (auditoria criada por sessão do Claude Cowork) seção por
seção — segurança, performance, gravidez, navegação/UX, acessibilidade. 9 seções
resolvidas e deployadas em produção no mesmo dia.

### Decisões de arquitetura que ficaram
- **Cockpit vira a entrada diária acionável** (checkbox de done inline, triagem
  inline do inbox); **Dashboard fica métricas/gráficos** — tinham ~80% de
  sobreposição. Decisão de produto tomada com o Leo antes de mexer.
- **Hooks de ação compartilhados** (`useToggleTaskDone()` em `tasks.ts`,
  `useConvertInboxToTask/Note()` em `inbox.ts`) extraídos de `tasks/page.tsx` e
  `inbox/page.tsx` para o Cockpit reusar sem duplicar lógica (inclui recorrência
  ao concluir task, que só existia inline antes)
- **`WEBHOOK_OWNER_ID`** (env var) substitui confiar em `owner_id` do payload dos
  webhooks — app de usuário único, sem sessão no contexto do webhook
- **Contraste de texto**: piso único `text-on-surface/40` (era `/20`-`/30` em
  vários lugares) — aplicado via script em 65 arquivos, não item a item

### Lições
- **NUNCA ter `middleware.ts` na raiz e em `src/` ao mesmo tempo** — ver AGENTS.md,
  tabela de Deploy Critical Lessons. Bug real de produção descoberto só por auditoria.
- **`tsc --noEmit` nunca passa neste projeto** (confirmado de novo) — pra validar que
  uma mudança não introduziu regressão, comparar a *contagem e o conjunto de arquivos*
  com erro contra uma baseline, não esperar zero erros
- **Ao adicionar um novo Dialog/overlay**, usar os primitivos do `@base-ui/react`
  direto (`Dialog.Root/Portal/Backdrop/Popup/Title/Close`) quando o layout for
  diferente do wrapper `DialogContent` pré-estilizado (que é modal centralizado) —
  ganha `role="dialog"`, focus trap e Escape de graça sem reescrever a lógica

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
