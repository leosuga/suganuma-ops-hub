# Deploy, infraestrutura e lições de deploy

Movido do AGENTS.md para reduzir contexto carregado por sessão. Leia sob demanda.

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

### next.config.ts — Next.js 16.4.2
- ⚠️ A chave `eslint` **não existe** no tipo `NextConfig` do Next.js 16.x. Usá-la causa erro de type check no build (`Object literal may only specify known properties`). **NUNCA adicionar `eslint: { ignoreDuringBuilds: true }`**.
- `images: { unoptimized: true }` é necessário para standalone Docker (sem otimizador de imagem)
- `typescript: { ignoreBuildErrors: false }` mantém o type check habilitado (padrão implícito, mas explícito é melhor)
- **`middleware.ts` continua suportado no 16.4.2** (só o aviso "use proxy instead"); o output standalone traz `.next/server/middleware-manifest.json` — a proteção de auth segue no container

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
| 2026-08-29 | **PGRST_DB_MAX_ROWS=1000 no PostgREST do VPS trunca toda query sem .range() silenciosamente** — useNotes pedia 2168 notas e recebia as 1000 mais recentes, sem erro (descoberto por probe PostgREST direto: `rows: 1000` vs DB count 2168). TODA query client de tabela que pode crescer (note, transaction, task...) precisa paginar em ranges de 1000. Fix no useNotes; audit das demais: volumes pequenos hoje (transactions=3, tasks=18) mas mesmas queries estourarão com o tempo | Silent data truncation |
| 2026-08-29 | **Schema do DB driftou das migrations: coluna favorited (0034/0028) não existia no DB real** — toda query .select("...favorited...") retornava HTTP 400 do PostgREST → /notes "vazia" em TODOS os devices. Redefinir coluna: rodar a migration idempotente de novo via psql (`docker exec -i supabase-db psql ... < migrations/0028_*.sql`). Diagnóstico: probe .select() do client e ler o message do 400 (42703) | Schema drift |

