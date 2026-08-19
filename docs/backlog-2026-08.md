# Backlog — auditoria de 2026-08-19

Revisão completa do código (segurança, performance/arquitetura, UX/funcionalidade)
feita em 2026-08-19. Cada item foi verificado no código antes de entrar aqui.

A base é sólida para um app pessoal — error boundaries com retry, undo global,
realtime com debounce, virtualização, lazy-loading correto das libs pesadas,
React Compiler ativo, HMAC timing-safe, tokens hasheados com auditoria. Nada aqui
exige reescrita; são correções pontuais e features incrementais.

Ordem sugerida: segurança (1) → bugs do dia a dia (2) → o que aposenta ferramenta
externa (5 e 6) → resto.

---

## 0. Já resolvido na branch `feat/oauth-mcp-connector`

- [x] **`middleware.ts` duplicado (raiz vs `src/`)** — a versão da raiz era a que o
      Next realmente carregava; confirmado procurando no chunk compilado uma string
      exclusiva da versão `src`. Consequência: o rate limiting de `/api/agent/*`
      documentado no AGENTS.md **nunca esteve ativo em produção**. Raiz removida.
- [x] **Rate limit contornável via `X-Forwarded-For` forjado** — o código usava a
      primeira entrada do XFF, que o cliente controla (o Caddy anexa ao final).
      Agora usa a entrada mais à direita. `src/middleware.ts`, `src/app/api/mcp/route.ts`.
- [x] **Validação de Host ignorada quando o header estava ausente** — enfraquecia a
      proteção contra DNS rebinding. `src/lib/mcp/auth.ts`.
- [x] **Open redirect no `?next=` do callback de auth** — `?next=//evil.com` redirecionava
      para fora do domínio após o login. `src/app/api/auth/callback/route.ts`.
- [x] **MCP só validava o token no `initialize`** — dentro de uma sessão aberta, nem
      revogação nem expiração tinham efeito. Agora revalida a cada requisição.

---

## 1. Segurança — vazamento real entre usuários ✅ resolvido em 2026-08-19

O schema é multi-owner e as rotas de agente usam service role (que **bypassa a RLS**).
Falha de scoping aqui é vazamento de verdade, não teórico.

- [x] **`GET /api/agent/habits/[id]/entries` não filtra por dono.** Consulta
      `habit_entry` só por `habit_id`; o `ownerId` é validado mas não usado na query.
      O POST logo abaixo faz a verificação certa — copiar o padrão dele.
      Exploração: token do usuário A lê as entradas (incluindo `notes`) do usuário B.
      Corrigido: valida `habit_track.owner_id = ownerId` antes do select.
- [x] **`GET /api/agent/reports` — query de `habit_entry` sem filtro nenhum.** Dentro
      do `Promise.all`, as outras três queries filtram por `owner_id`; essa não.
      Retorna até 500 entradas de todos os donos.
      Corrigido: filtra por `habit_id in (hábitos do dono)`, buscado após o `Promise.all`.

## 2. Segurança — restante ✅ resolvido em 2026-08-19

- [x] **Anexos de notas em bucket público.** `note-attachments` foi criado como
      público e as policies de storage estão **comentadas** na migration
      `0029_note_attachments.sql`; `src/lib/storage.ts` usa `getPublicUrl()`, que gera
      URL permanente e sem autenticação. Tornar o bucket privado, aplicar as policies
      e trocar por `createSignedUrl()` com expiração.
      Corrigido: migration `0036_note_attachments_private.sql` (bucket privado + RLS
      real), `storage.ts` usa `createSignedUrl()` (7 dias), `NoteAttachments.tsx`
      reassina a URL a cada render. Bucket estava vazio (0 objetos) — sem dado
      legado para migrar. **Migration 0036 ainda precisa ser aplicada manualmente
      no SQL Editor do Supabase.**
- [x] **CSP com `unsafe-inline` e `unsafe-eval` em `script-src`** (`next.config.ts`).
      Anula boa parte da proteção contra XSS. Migrar para nonce; verificar se o
      `unsafe-eval` é mesmo necessário em produção (normalmente não).
      Parcial: `unsafe-eval` removido (React/Next não usam eval em produção, só dev).
      `unsafe-inline` mantido — migrar para nonce exige renderização dinâmica em
      TODAS as páginas (perde SSG/ISR), é um projeto à parte, não uma correção pontual.
- [x] **Webhooks: secret único compartilhado + `owner_id` vindo do payload.** Os três
      webhooks usam o mesmo `WEBHOOK_SECRET`. Quem comprometer um emissor escreve
      tasks/transações em nome de qualquer owner. Derivar o owner no servidor e usar
      secrets distintos por webhook.
      Parcial: `owner_id` agora vem de `WEBHOOK_OWNER_ID` (env var), nunca do payload
      (`resolveWebhookOwnerId()` em `hmac.ts`). **Precisa do secret `WEBHOOK_OWNER_ID`
      no GitHub Actions** (valor: o UUID do usuário único do hub) — sem ele os 3
      webhooks retornam 500 (fail-closed, não quebra em modo inseguro).
      Secrets distintos por webhook NÃO foi feito: email-to-task e csv-from-bank têm
      emissores externos a este repo (fora do meu alcance rotacionar sem coordenar).
- [x] **FKs de escrita não validadas contra o dono** — `account_id` em
      `/api/agent/finance/transactions`, `meal_id` em `/api/agent/meals/plans`.
      Corrigido: valida que o FK pertence a `ownerId` antes do insert/update.

## 3. Bugs que afetam o uso diário ✅ resolvido em 2026-08-19

- [x] **`today()` usa UTC** (`src/lib/date.ts`). `toISOString().slice(0,10)` faz o
      "hoje" do app virar às 21h em São Paulo. Afeta marcação de hábitos à noite,
      filtro do Cockpit, daily notes, notificações de evento e o `^today` do
      parse-title. Trocar por
      `Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" })` — retorna
      `YYYY-MM-DD` direto.
      Corrigido: `date.ts` (`today`/`dateStr`), `cockpit/route.ts`, `notifications.ts`,
      `QuickAddNote.tsx` (daily notes), `parse-title.ts` (`^today`/`^tomorrow` com
      offset fixo `-03:00`, já que roda também no servidor/MCP em container UTC).
      Não auditados os ~20 outros usos de `toISOString().slice(0,10)` espalhados no
      código (dashboard, finance, calendar etc.) — a maioria não é semântica de "hoje"
      (datas já selecionadas pelo usuário, agrupamento por mês); precisa de revisão
      caso a caso, não uma troca em massa.
- [x] **Realtime silenciosamente quebrado para `habit_entry` e `protocol_entry`.**
      `src/lib/realtime.ts` aplica `filter: owner_id=eq.<uid>` em toda tabela, mas
      essas duas não têm a coluna. A subscription nunca entrega evento e o erro é
      invisível. Mapear as tabelas sem `owner_id` para subscrever sem filtro.
      Corrigido: `NO_OWNER_FILTER_TABLES` em `realtime.ts`.
- [x] **Notas criadas via API de agente/MCP não entram no índice vetorial.** As rotas
      `/api/agent/notes` não chamam `syncNoteEmbedding` (só as mutations da UI chamam),
      então nota capturada por agente fica invisível na busca semântica. Chamar
      fire-and-forget na rota, ou job de reconciliação Qdrant × Postgres.
      Corrigido: `syncNoteEmbeddingForOwner()` extraído de `syncNoteEmbedding` (o
      original exige sessão via cookie, incompatível com rota Bearer-only), chamado
      fire-and-forget no POST/PATCH de `/api/agent/notes`; `deleteNoteEmbedding` no DELETE.

## 4. Performance — parcial, resolvido em 2026-08-19

- [ ] **`auth.getUser()` dentro de queryFn** — faz round-trip HTTP serial antes de cada
      fetch (~100–300ms por query, em cascata no dashboard). Ocorre em `annual.ts`
      (9×), `calendar.ts`, `notes.ts`, `meals.ts`, `inbox.ts`. O RLS já garante o
      escopo: `tasks.ts` e `finance.ts` já fazem certo — alinhar os demais.
      **Não feito** — sem acesso a SQL direto (só REST) para confirmar que a RLS de
      `annual_event`/`note`/`meal`/`meal_plan`/`inbox_item` está tão correta quanto a
      de `task`. Trocar o filtro explícito por confiança cega na RLS sem essa
      confirmação arrisca vazamento entre usuários — checar `pg_policies` no SQL
      Editor antes de mexer.
- [x] **Over-fetching que cresce com o tempo** — `useTransactions()` sem filtro nem
      limite na página Review (busca a tabela inteira para mostrar uma semana);
      `select("*")` em `note` traz a coluna `search_vector` inteira; o dashboard carrega
      o conteúdo completo de todas as notas para contar e exibir 2 pinned.
      Corrigido: `TransactionFilters` ganhou `from`/`to`, Review passa a semana em
      revisão. `notesOptions`/`dailyNoteOptions` usam select explícito sem
      `search_vector`. Dashboard não mexido — reusa o cache de `useNotes()` da
      página Notes (mesma queryKey), não há fetch extra específico dele.
- [x] **Busca híbrida serial** (`src/lib/hybrid-search-core.ts`): embedding → check de
      collection (a cada busca) → Qdrant → só então FTS. Vetorial e FTS são
      independentes: `Promise.all` corta ~40% da latência; cachear o `ensureCollection`
      em variável de módulo.
      Corrigido: `Promise.allSettled` para as duas buscas; `ensureCollection()` cacheia
      o resultado numa variável de módulo (`qdrant.ts`).
- [x] **`triageAllPending` roda até 20 chamadas LLM em série** numa única server action
      (risco de timeout e retriagem duplicada). Lotes de 3–5 com `Promise.allSettled`.
      Corrigido: lotes de 4 com `Promise.allSettled`.
- [x] **Backlinks O(N²)** — cada `NoteRow` varre todas as notas. Construir um
      `Map<titulo, backlinks[]>` uma vez no parent com `useMemo` e passar por prop.
      Corrigido: `buildBacklinksMap()` em `src/lib/links.ts`, computado uma vez em
      `NotesPage` e `ProjectNotesDialog`, passado como prop `backlinksMap` (substituiu
      `allNotes`).
- [ ] **Dashboard abre ~10 canais realtime** e invalida listas inteiras a cada evento.
      Tolerável hoje; consolidar canais e aplicar o payload via `setQueryData` nas
      tabelas quentes quando quiser polir.
      **Não feito** — o próprio item já dizia "tolerável hoje... quando quiser polir".

Confirmado que já está bom: recharts/cmdk/react-markdown/papaparse fora do bundle
inicial, `optimizePackageImports` configurado, índices compostos adequados às queries.
Com o React Compiler ativo, a exigência de memoização manual do AGENTS.md está obsoleta
— deps manuais erradas hoje são mais risco que ganho.

## 5. Notificações — o que aposenta o Todoist

- [ ] **Não existe Web Push.** `src/lib/notifications.ts` usa `new Notification()` no
      cliente com polling de 5 min: nada dispara com o app fechado, e no iOS esse
      construtor nem existe (só Web Push via service worker em PWA instalada).
      O `public/sw.js` não tem handler `push` nem `notificationclick`, não há VAPID
      nem tabela de subscriptions. **É a lacuna que mantém o Todoist necessário.**
      Caminho: par VAPID → tabela `push_subscription` → botão em `/settings` chamando
      `registration.pushManager.subscribe()` (a permissão precisa vir de gesto do
      usuário; hoje o `requestPermission()` roda no mount do AppShell, que os
      navegadores ignoram) → handlers no sw.js → cron no VPS enviando via `web-push`.
- [ ] **Só existe aviso de atraso, não lembrete.** A query filtra `due_at < now`, então
      o usuário só descobre depois de perder o prazo. Adicionar janela "vence em breve"
      com dedup (`notified_at` na task) no mesmo cron.

## 6. Finanças — o que aposenta as bases do Notion

- [ ] **Sem recorrência e sem contas a pagar.** `transaction` só tem `occurred_on`
      (passado); não há despesa fixa nem vencimento. Tabela `recurring_transaction`
      (descrição, valor, categoria, dia do mês, conta) + `due_on`/`paid` dá o widget
      "A VENCER" no dashboard e alimenta o push do item 5.
- [ ] **Budget é um número único por mês.** As categorias já existem nas transactions —
      falta coluna `category` na tabela budget e a comparação meta × realizado.

## 7. Gravidez — alto valor, custo baixo ✅ resolvido em 2026-08-19

O `PregnancyCard` já calcula semanas a partir da DPP. Falta, em ordem de valor:

- [x] Countdown de dias para a DPP e trimestre atual (poucas linhas).
      Corrigido: `daysUntil()`/`trimesterOf()` em `PregnancyCard.tsx`, contagem
      âncorada em `today()` (fuso São Paulo), não em `new Date()` cru.
- [x] Timeline de exames pré-natais — os `appointment` já têm `kind`; basta a convenção
      `kind="prenatal"` e uma seção no card.
      Corrigido: seção "EXAMES PRÉ-NATAIS" no card, filtra `appointment.kind === "prenatal"`.
      Placeholder do campo Tipo em `AddAppointmentDialog` atualizado para sugerir a
      convenção (o campo já era texto livre, sem dropdown para travar).
- [x] Checklist de preparação (enxoval, documentos, mala da maternidade) — dá para
      resolver sem código novo, com um template "Chegada do bebê" em
      `src/lib/templates.ts`, no mesmo mecanismo dos 5 templates existentes.
      Corrigido: template `baby-arrival` com 10 tasks, aparece automático no
      CreateProjectDialog (que já itera `TEMPLATES` sem contagem fixa).
- [x] Marcos por semana (24: viabilidade, 37: termo) — array hardcoded resolve.
      Corrigido: `MILESTONES` (12/20/24/28/37/40 semanas) em `PregnancyCard.tsx`,
      mostra o próximo marco a partir da semana atual.

## 8. Navegação e UX — parcial, resolvido em 2026-08-19

- [x] **Módulos órfãos no mobile**: `/meals`, `/habits` e `/reports` não aparecem nem na
      BottomNav nem no menu HUB, e o CommandPalette é inacessível no celular (o botão
      é `hidden md:flex`). O grid do HUB comporta os três.
      Corrigido: os 3 adicionados ao `HUB_ITEMS` em `BottomNav.tsx`.
- [x] **No desktop, o inverso**: `/inbox` e `/cockpit` não estão na Sidebar — justamente
      as duas páginas de workflow diário.
      Corrigido: os 2 adicionados ao `NAV_ITEMS` em `Sidebar.tsx`.
- [ ] **Cockpit × Dashboard: ~80% de sobreposição**, com queries duplicadas. Decidir:
      ou matar a página `/cockpit` e manter só o endpoint `get_daily_cockpit` para
      agentes, ou tornar o Cockpit acionável e enxugar o Dashboard.
      **Não feito** — é decisão de produto (qual página o usuário realmente usa no dia
      a dia), não correção mecânica. Perguntei ao Leo antes de mexer.
- [x] **Captura global inexistente fora do `/inbox`.** O `AppShell` renderiza
      `<CommandPalette>` sem a prop `onAddTask`, então a ação "Nova task" do palette
      nunca aparece. Passar a prop, adicionar uma ação "capturar no inbox" e
      `shortcuts` no `manifest.ts` (long-press no ícone da PWA).
      Corrigido: `AppShell` agora monta `QuickAddDialog` global e passa `onAddTask`;
      `CommandPalette` ganhou a ação "Capturar no Inbox"; `manifest.ts` ganhou
      `shortcuts` (Inbox, Nova Task).
- [x] **Cockpit sem estado de loading** — mostra "Inbox zero" e "Nenhuma urgente"
      durante o fetch: um falso "tudo em dia" no briefing.
      Corrigido: skeleton enquanto `tasks`/`inbox`/`appointments`/`events` carregam.
      De caminho, corrigido também `todayStr = new Date().toISOString().slice(0,10)`
      (mesmo bug de fuso da seção 3) para `today()`.
- [x] **Erros de mutation são silenciosos** — só vão para o logger; o optimistic update
      reverte sem o usuário saber. Reusar o `UndoToast` como toast de erro no `onError`
      global.
      Corrigido: `showErrorToast()` exportado de `UndoToast.tsx` (função pura, fora de
      componente — o `onError` global do `QueryClient` roda antes do
      `UndoToastProvider` montar em JSX), chamado no `onError` de `AppShell`.
- [x] **PWA offline é só de fachada** (NetworkOnly + `offline.html`). Mínimo viável sem
      mexer na arquitetura: persistir o cache do TanStack Query
      (`@tanstack/query-persist-client`) para leitura offline.
      Corrigido: `@tanstack/react-query-persist-client` +
      `@tanstack/query-sync-storage-persister` instalados, `AppShell` trocou
      `QueryClientProvider` por `PersistQueryClientProvider` (localStorage, 24h).
      **Trade-off aceito com o Leo**: dados de tasks/finanças/saúde passam a ficar
      persistidos no localStorage, não só em memória.
- [x] **TopBar sem label para 5 rotas** (`/cockpit`, `/inbox`, `/projects`, `/reports`,
      `/review`) — todas caem no fallback "OPS HUB".
      Corrigido: os 5 adicionados a `PAGE_LABELS` em `TopBar.tsx`.

## 9. Acessibilidade

- [ ] **Contraste**: o padrão `text-on-surface/20-30` em labels de navegação e estados
      vazios dá ~1.5–1.9:1 (mínimo AA é 4.5:1, e as fontes são de 8–11px, então não
      vale a regra de texto grande). Piso de `/50` para texto informativo e `/40` para
      labels inativos preserva a estética terminal.
- [ ] **Touch targets** de 24px e fontes de 7–9px no shell. Expandir a área clicável
      (`p-2 -m-2` / `min-h-[44px]`) e subir para 10px no mobile.
- [ ] **Overlay do menu HUB** é um `div` manual: sem `role="dialog"`, sem
      `aria-expanded`, sem focus trap e não fecha com Escape. Trocar pelo Dialog do
      `@base-ui/react`, que já é dependência.

---

## Notas de contexto

- **Migrations são aplicadas manualmente** no SQL editor do Supabase (ver AGENTS.md).
  `0035_oauth.sql` e `0036_note_attachments_private.sql` já foram aplicadas (2026-08-19).
- **Os testes `.test.tsx` falham no ambiente node** do `vitest.config.ts` — é
  pré-existente e esperado; usar `npm run test:docker` para os testes de componente.
- **`.env.local` contém a `SUPABASE_SERVICE_ROLE_KEY` real** (a chave que bypassa RLS).
  Está corretamente coberta pelo `.gitignore` — nunca forçar com `git add -f`.
