# Handoff — Melhorias do módulo Notas (Ops Hub)

> Versão 2, de 04/11/2026. Reescrita depois de auditar a v1 contra o código e contra a
> produção (buscas read-only pelo MCP). O que a v1 trazia como hipótese agora está
> provado ou corrigido — ver seção 3.
> Destinatário: agente de código local (Claude Code / DeepSeek / Antigravity).
> Referências de linha conferidas no working tree em 04/11/2026 — revalide antes de editar.

## 1. Contexto

Ops Hub é um app pessoal Next.js 16 + Supabase (Postgres/RLS) com PWA, servidor MCP remoto em `/api/mcp` (OAuth, ferramentas em `src/lib/mcp/tools.ts`, que chamam as rotas `/api/agent/*` via `agentApi()` de `src/lib/mcp/api.ts`) e deploy no VPS via GitHub Actions. O módulo **Notas** (tabela `note`, migrações `0007_notes.sql`, `0024`–`0029`, `0033_hybrid_search.sql`, `0036`) suporta markdown, wikilinks/backlinks, MOC, PARA, daily notes, anexos e **busca híbrida**: vetorial (Ollama `nomic-embed-text` → Qdrant, `src/lib/ollama.ts`, `src/lib/qdrant.ts`) + FTS Postgres (`search_vector` tsvector `portuguese`, título peso A / conteúdo peso B), fundidas por RRF em `src/lib/hybrid-search-core.ts`. A ponte **Raindrop → Notas** (`src/app/api/integrations/raindrop-sync/route.ts`, doc `docs/raindrop-hub-bridge.md`) cria notas `para: resources` ou itens de Inbox. **Siga as convenções de `CLAUDE.md` e `AGENTS.md`** (estrutura de módulos, queries/schemas, padrões de teste).

## 2. Regras para o agente

1. **Um PR por item**, cada um em branch própria (ex.: `fix/notes-fts-websearch`), aberto no GitHub em `leosuga/suganuma-ops-hub`.
2. **Nunca fazer merge nem deploy.** Leonardo revisa e aprova. Não disparar workflows (`deploy.yml`, `raindrop-sync.yml`, `embeddings-reconcile.yml`).
3. Antes de abrir o PR: `npm run lint`, `npm test`, `npm run build` — todos verdes. Cole o resultado na descrição do PR.
4. **Nenhuma migração de dados nem script em massa contra produção.** Migrações de schema só como arquivo novo em `supabase/migrations/`, sem aplicar.
5. Não ler, imprimir, criar nem alterar secrets/`.env*`. Variáveis novas: só documentar o NOME em `.env.prod.example` sem valor.
6. Mudanças pequenas e focadas; sem refactors fora do escopo. Descrição do PR: objetivo, mudanças, testes, riscos, como validar.
7. **PR 1 e PR 2 mexem na mesma função.** O PR 2 só começa depois que o PR 1 estiver mergeado — ver o aviso na seção 4.
8. **Critério de aceite verificável pelo agente = teste unitário.** Nenhum PR aqui pede validação em produção: o ambiente com Qdrant + Ollama é do Leonardo. Onde o aceite depende de ambiente real, está marcado como "valida o Leonardo".

## 3. Diagnóstico

### 3.1 Provado em produção (04/11/2026)

**A busca "híbrida" só é híbrida para queries de UMA palavra.** Duas buscas via `notes_search_semantic`:

| query | palavras | `source` dos resultados |
|---|---|---|
| `drift` | 1 | **100% `hybrid`** |
| `data drift` | 2 | **100% `vector`** — zero FTS |

Causa, em [`src/lib/hybrid-search-core.ts:58`](../src/lib/hybrid-search-core.ts): `.textSearch("search_vector", q, { config: "portuguese" })` **sem `type`** → PostgREST usa o operador `fts` → `to_tsquery('portuguese', 'data drift')` → **erro de sintaxe no Postgres** (`to_tsquery` não aceita espaço nu). O `Promise.allSettled` captura, o `logger.warn("FTS search failed (non-blocking)")` esconde, e sobra só o vetorial. Toda query de 2+ palavras perde a perna FTS em silêncio. É um bug de uma linha com efeito grande — daí o PR 1.

**O timeout não tem relação com o tamanho da query.** A v1 registrou `-32001` em "consultas longas em PT". Reproduzido agora: `"como avaliar agentes de IA com benchmarks"` **respondeu rápido**, com o modelo já quente das duas buscas anteriores. Embedar 6 palavras custa o mesmo que embedar 2. A causa é **cold start do `nomic-embed-text`**, que atinge *qualquer* query depois de ociosidade. Isso inverte a prioridade do PR 2: `keep_alive` é o fix, o timeout é a rede de segurança.

**O Raindrop já é idempotente — as duplicatas não são re-ingestão.** `src/app/api/integrations/raindrop-sync/route.ts` (~l. 315) chama `checkWebhookIdempotency("raindrop", String(item._id))` e pula replays; o cursor tem guard otimista. As duplicatas do Inbox vêm de **URL salva duas vezes no Raindrop** (`_id` diferente) ou de **cross-source** (Share Target `manual` + Raindrop). Dedupe por URL continua sendo o design certo, mas é duplicata do usuário, não bug do sync — valor menor do que a v1 sugeria.

**O `select("*")` devolve o tsvector — e em duas rotas, não uma.** [`src/app/api/agent/notes/route.ts:24`](../src/app/api/agent/notes/route.ts) e `src/app/api/agent/tasks/route.ts:27` e `:53`: `task` também ganhou `search_vector` na migration 0033. A v1 só viu o lado das notas.

**Re-embedding não é necessário ao mexer em tags.** `createNoteWithEmbedding` → `syncNoteEmbeddingForOwner({ id, title, content, owner_id })`: o texto embedado é só título + conteúdo. Tags não entram.

### 3.2 Medido na v1 (mantido)

- `notes_tags` devolveu **1.251 tags distintas**; nas 200 notas amostradas, 341 distintas e 275 usadas uma vez.
- Variantes convivendo: `power-bi`/`powerbi`, `machine-learning`/`machinelearning`/`ml`/`machine learning`, `data-science`/`datascience`, `data-drift`/`datadrift`, `drift detection`/`model drift`. Tags antigas com espaço, anteriores à sanitização atual do `routeReference`.
- Nas 200: 191 (95%) vêm do Raindrop (`para: resources`), 9 são automáticas (cursor do sync, memory flush, wiki do autoresearch, briefing). 199/200 nunca editadas; 0 com `last_review`, 0 MOC, 0 wikilinks.
- Inbox: 50 itens `unprocessed` (limite default), de ago–out; 30 `raindrop`, 20 `manual`; ao menos 2 links duplicados.
- `GET /api/agent/notes` só aceita `limit` (máx. 200); `GET /api/agent/inbox` aceita `status` e `limit`. Nenhuma das duas pagina nem devolve total.

### 3.3 Leitura dos números

O acervo **não está morto** — um arquivo de bookmarks deve ficar sem edição. O que os zeros mostram é que as features de *organização* (MOC, wikilink, fila de revisão) não são usadas. O valor do módulo é **recuperação**: é aí que os PRs 1–4 entregam. Normalizar taxonomia e paginar filtros otimizam um caminho de leitura que ainda não existe — por isso foram rebaixados.

### 3.4 Não medido (medir antes de investir)

- **Total real de notas.** Nunca foi contado: `notes_list` trava em 200 e não devolve total. Se o acervo tem ~230 notas, paginação por cursor resolve um problema que não existe. Conta read-only, tarefa do Leonardo:
  ```
  docker exec -i supabase-db psql -U supabase_admin -d postgres -c "select count(*) from note;"
  ```
- Se o secret `EMBEDDINGS_RECONCILE_SECRET` existe. Sem ele, `embeddings-reconcile.yml` sai com exit 0 sem fazer nada. Tarefa do Leonardo.

## 4. PRs

Ordem recomendada: **1 → 2** (sequenciais, mesma função), **3 e 4** em paralelo a qualquer momento, **5** só depois de decidir a taxonomia.

> ⚠️ **PR 2 nunca antes do PR 1.** O PR 2 faz "vetor estourou → segue só com FTS". Com o FTS quebrado, isso devolve **zero resultados em silêncio** em vez de um timeout — pior que o bug atual. Os dois também editam as mesmas ~20 linhas de `hybridSearchCore`, então PRs paralelos conflitam. Se o Leonardo preferir, os dois podem virar **um único PR** ("busca híbrida: FTS + latência"); a regra "um assunto por PR" aceita isso porque é a mesma função e o mesmo sintoma.

### PR 1 — Corrigir a perna FTS da busca híbrida
- **Objetivo:** queries de 2+ palavras voltam a gerar hits FTS e fusão `hybrid`.
- **Arquivos:** `src/lib/hybrid-search-core.ts` (l. ~58, dentro de `hybridSearchCore` l. 36); teste novo `tests/hybrid-search-core.test.ts` (mocks conforme `tests/__mocks__` e `tests/setup.ts`).
- **Passos:**
  1. Trocar para `.textSearch("search_vector", q, { config: "portuguese", type: "websearch" })`. `type: 'websearch'` existe no `@supabase/postgrest-js` 2.105.4 instalado (verificado em `dist/index.d.cts`) e mapeia para `websearch_to_tsquery`, que aceita espaços, aspas e `-`.
  2. Manter o `logger.warn` da perna FTS, mas incluir a `query` e a mensagem do erro — hoje uma falha de sintaxe fica indistinguível de "não achou nada".
  3. Expor no retorno um campo de debug opcional `{ fts_ok, vector_ok }`, **aditivo** (não quebrar o contrato de `{ ok, results }` consumido por `src/app/api/agent/search/notes/route.ts` e `src/lib/queries/semantic-search.ts`).
- **NÃO fazer:** o fallback `config: "simple"` que a v1 propunha. O `search_vector` é *construído* com `to_tsvector('portuguese', ...)` (migration 0033), então um tsquery `simple` só casaria lexemas que o stemmer português não alterou — na prática, quase nada. Fazer isso direito exigiria uma segunda coluna tsvector + migration + backfill, o que está fora de escopo. Registre essa decisão na descrição do PR.
- **Testes:** (a) query multi-palavra chama `textSearch` com `type: "websearch"`; (b) quando vetor e FTS devolvem o mesmo id, `source === "hybrid"`; (c) FTS lançando erro não derruba a busca e marca `fts_ok: false`.
- **Aceite:** lint/test/build verdes. **Valida o Leonardo** após o deploy: `data drift` passa a trazer `hybrid`/`fts` (hoje é 100% `vector` — baseline provado na seção 3.1).
- **Riscos:** o RRF muda a ordenação dos resultados (esperado — é o ponto). `websearch` interpreta `-` como negação e aspas como frase: comportamento desejado, mas documente na descrição.
- **Expectativa honesta:** `websearch_to_tsquery` faz **AND de todos os termos**. `"como avaliar agentes de IA com benchmarks"` → `avaliar & agentes & ia & benchmarks` → provavelmente 0 hits FTS. O ganho é real para 2–4 termos (`data drift`, `power bi`, `fine tuning`), **não** para frases em linguagem natural — essas continuam sendo atendidas pelo vetorial, e isso está correto.

### PR 2 — Latência: modelo quente + teto na perna vetorial
- **Depende de:** PR 1 mergeado.
- **Objetivo:** a busca nunca estoura o timeout do cliente MCP, e o caso comum (modelo quente) nem chega perto do teto.
- **Arquivos:** `src/lib/ollama.ts` (`embedTexts` l. 25, `embedText` l. 50, `OLLAMA_TIMEOUT_MS` l. 23); `src/lib/hybrid-search-core.ts`; `src/app/api/agent/search/notes/route.ts`. Não mexer em `src/lib/mcp/api.ts` (o teto de 30 s lá é a defesa correta de última instância).
- **Passos, nesta ordem de importância:**
  1. **`keep_alive` no request de embed** — este é o fix, não um extra. Mandar `keep_alive` no corpo do `POST /api/embed` (confirmar o nome do campo na API do Ollama instalado antes de assumir; a alternativa é `OLLAMA_KEEP_ALIVE` no ambiente do container, que é config de infra e aí é tarefa do Leonardo — nesse caso só documente). Com o modelo residente, o cold start desaparece e o timeout do passo 2 quase nunca dispara.
  2. **Teto próprio na perna vetorial** em `hybridSearchCore`: env `SEARCH_EMBED_TIMEOUT_MS`, default 8000. Ao estourar, seguir só com FTS e marcar `vector_ok: false` (campo já criado no PR 1). Documentar o NOME da env em `.env.prod.example`.
  3. Permitir passar timeout opcional para `embedText`/`embedTexts`, **sem alterar o default de 120 s** usado pelo raindrop-sync (lá o lote longo é legítimo).
  4. Log de duração por perna (`vector_ms`, `fts_ms`) no `logger.info` — é o que faltou para diagnosticar isso da primeira vez.
- **Testes:** com fake timers, um embedding que demora mais que `SEARCH_EMBED_TIMEOUT_MS` → resposta só com FTS, `ok: true`, `vector_ok: false`, em menos que o timeout + margem; e o default do `embedTexts` segue 120 s quando nenhum timeout é passado.
- **Aceite:** lint/test/build verdes. **Valida o Leonardo**: busca pelo MCP após horas de ociosidade não dá mais `-32001`.
- **Riscos:** quando o Ollama está lento, a busca perde a parte semântica e fica só com o AND do FTS — que, como diz o PR 1, costuma dar zero em frases longas. Resultado vazio rápido é aceitável e fica logado, mas é uma troca real: registre na descrição do PR.

### PR 3 — Parar de trafegar o tsvector nas rotas de agente
- **Independente.** Pode ir em paralelo aos outros.
- **Objetivo:** as rotas de agente param de devolver a coluna `search_vector` (payload inútil que consome contexto de todo cliente MCP).
- **Arquivos:** `src/app/api/agent/notes/route.ts` (l. 24), `src/app/api/agent/notes/[id]/route.ts` (l. 31), `src/app/api/agent/tasks/route.ts` (l. 27 e 53), `src/app/api/agent/tasks/[id]/route.ts` (l. 32), `src/app/api/agent/tasks/parse/route.ts` (l. 49), `src/app/api/agent/tasks/[id]/complete/route.ts` (l. 18).
- **Passos:**
  1. Trocar `select("*")` por lista explícita de colunas nessas rotas — todas as colunas atuais **menos** `search_vector`. Nas demais rotas de agente, deixar `select("*")` como está: só `note` e `task` têm tsvector (migration 0033).
  2. Conferir se algum consumidor depende do campo: `grep -rn "search_vector" packages/ ops-hub-sdk src/` e os usos de `/api/agent/notes` e `/api/agent/tasks`.
- **Testes:** teste de rota garantindo que a resposta não contém `search_vector` e que os campos usados pelas tools MCP (`notes_list`, `tasks_list`) continuam presentes.
- **Aceite:** lint/test/build verdes; resposta sem `search_vector`; nenhum campo consumido desapareceu.
- **Riscos:** esquecer uma coluna nova no futuro — a lista explícita precisa ser atualizada junto com a migration. Deixe um comentário curto na rota dizendo isso.

### PR 4 — Dedupe por URL na ponte Raindrop
- **Independente.** Não depende de normalização de tags.
- **Objetivo:** a mesma URL não gera dois registros, mesmo vindo por caminhos diferentes (Raindrop + Share Target).
- **Arquivos:** `src/app/api/integrations/raindrop-sync/route.ts` (`routeReference` l. ~225, `routeActionable` l. ~242); teste novo.
- **Passos:**
  1. Função pura de normalização de URL em módulo próprio e testável: minúsculas no host, remover `utm_*`/`fbclid`/`gclid`, remover `/` final, remover fragmento. **Não** mexer em path case (alguns sites são case-sensitive).
  2. Antes de criar: checar se já existe nota com `Fonte: <url normalizada>` no `content` do dono, ou `inbox_item` cujo `content` contenha a URL normalizada. Se existir, contar como `skipped` no retorno do handler (já existe o contador) e logar.
  3. Atualizar `docs/raindrop-hub-bridge.md` dizendo que a idempotência agora tem duas camadas: `raindrop_id` (replay do mesmo bookmark, já existia) e URL (mesmo link salvo duas vezes ou por outro caminho).
- **Testes:** URL repetida com `utm_*` diferente não cria segundo registro; URL nova cria; o dedupe não derruba o item quando a checagem falha (não-bloqueante, loga e segue criando — melhor duplicar que perder).
- **Aceite:** lint/test/build verdes; sync simulado com mocks não gera duplicata.
- **Riscos:** a busca por substring em `content` é frágil se o formato da nota mudar. Se quiser robustez, o caminho certo é uma coluna `source_url` + índice único parcial — mas isso é migration de schema e fica para depois; documente a escolha.

### PR 5 — `normalizeTag` só nos caminhos de máquina
- **Bloqueado por uma decisão sua**, não por código. Ver a ressalva abaixo.
- **Objetivo:** parar a entrada de novas variantes de tag, sem tocar em dado existente nem no que o usuário digita.
- **Arquivos:** novo `src/lib/tags.ts`; aplicar em `src/app/api/agent/notes/route.ts` (`createSchema` l. 7–12), `src/app/api/agent/notes/[id]/route.ts` (l. 10) e `routeReference` do raindrop-sync; testes `tests/tags.test.ts`.
- **⚠️ `normalizeTag` NÃO pode comer a barra.** `/` é feature de primeira classe: [`src/lib/notes-filter.ts:40`](../src/lib/notes-filter.ts) agrupa tags por prefixo e `ctx/<contexto>` é o mecanismo de contexto das notas (ver `src/lib/contexts.ts`). As regras da v1 (espaços/underscore → `-`) somadas ao regex `[^a-z0-9_-]` herdado do `routeReference` transformariam `ctx/trabalho` em `ctx-trabalho` e derrubariam o filtro de contexto + CommandPalette **sem erro nenhum**. A barra entra na allowlist do regex e é preservada.
- **Regras de `normalizeTag`:** minúsculas; remover acentos; espaços/underscores → `-`; colapsar `-` repetidos; **preservar `/`** (um só, sem barra no início/fim); aplicar sinônimos; dedupe preservando ordem; **não tocar tags de sistema** (`raindrop-sync-state`, `memory-flush`, `raindrop`).
- **NÃO aplicar nos write paths da UI** nesta primeira rodada (`src/lib/queries/notes.ts`: `useCreateNote`, `useUpdateNote`, `useBulkUpdateNotes`). Normalizar o que o usuário acabou de digitar é uma reescrita silenciosa do input dele; e é exatamente ali que as tags com `/` são criadas à mão. Só nos caminhos de máquina (agente/MCP/Raindrop), onde a origem é um LLM.
- **Testes:** cada sinônimo do mapa aprovado; acentos; espaços; dedupe; **`ctx/trabalho` e `projeto/reforma` sobrevivem intactas**; tags de sistema preservadas; idempotência (`normalize(normalize(x)) === normalize(x)`).
- **Aceite:** lint/test/build verdes; nenhum dado existente alterado neste PR.
- **Ressalva — decida a taxonomia antes de alguém escrever isso:** o mapa de sinônimos da v1 (`ml → machine-learning`, `agent`/`agente`/`agentes → agents`, `stats → statistics`) é **decisão de produto, não tarefa de código**. `ml` fundido em `machine-learning` é razoável; `agentes → agents` mistura PT e EN num vocabulário que o resto do app escreve em português. Nenhum agente deve escolher isso. Mapa aprovado → este PR fica trivial.

## 5. Adiado, com o motivo

Não é "fora de escopo" genérico: cada item abaixo foi avaliado e rebaixado.

- **Script de migração em massa das tags** (`scripts/normalize-note-tags.mjs`, 1.251 → ~100 tags). Dois motivos: (a) a regra 4 proíbe o agente de rodá-lo, então o PR entregaria **código morto** até você rodar à mão; (b) depende do mapa de sinônimos que ainda não foi decidido (PR 5). Quando o mapa existir e você quiser rodar, este script volta — dry-run por padrão, `--apply` com confirmação interativa.
- **Paginação e filtros em `/api/agent/notes` e `/api/agent/inbox`** (`offset`/cursor, `tag`, `para`, `since`, `q`, `total` com `count: "exact"`). Resolve "o bot não consegue percorrer todo o acervo" — mas o total nunca foi medido (seção 3.4). Com o PR 1 mergeado, a busca cobre a maior parte dos casos de recuperação e a travessia completa perde urgência. **Meça primeiro.** O recorte de payload (`select` explícito) já saiu disso e virou o PR 3, que é o pedaço que vale sozinho.
- **Vocabulário controlado no prompt do Raindrop** (lista fixa de tags no `CLASSIFY_SYSTEM`, filtro no código). Depende do PR 5 e do mapa. O filtro no código é obrigatório porque o LLM vai ignorar a lista — mas sem o vocabulário decidido não há o que filtrar.
- **Inconsistência achada de passagem, não endereçada em nenhum PR:** `GET /api/agent/inbox` ordena `created_at` **DESC**, enquanto o Inbox do app é **FIFO (ASC)** por decisão explícita (AGENTS.md, "Captura"). O agente e você veem a fila em ordens opostas — quem tria pelo MCP pega o item mais novo, quem tria pela UI pega o mais antigo. Conserto de uma linha, mas é mudança de comportamento: decida se o agente deve seguir a fila do app.
- **Fila de revisão** (`last_review`) no `/review` + tool MCP de "resumo da semana do que foi salvo".
- **Separar tipos** (`kind`: link / nota / daily / sistema) e esconder notas de sistema da lista. Com 95% do acervo vindo do Raindrop e notas de sistema (cursor, memory flush) na mesma lista, isso provavelmente vale mais que tudo na seção 4 depois do PR 1 — mas é design de produto, não correção.
- **Auto-links e MOCs sugeridos** via embeddings (sugestão; usuário aceita).
- **Testes de integração** da busca híbrida e da ponte Raindrop (com Qdrant/Postgres de teste).

## 6. Prompts prontos para colar

- PR 1: `Leia docs/handoff-notas.md e execute o PR 1 (FTS websearch) seguindo as regras da seção 2. Não implemente o fallback config:"simple" — o PR explica por que. Não faça merge nem deploy.`
- PR 2: `Leia docs/handoff-notas.md e execute o PR 2 (keep_alive + teto na perna vetorial). Confirme que o PR 1 já está em main antes de começar. Siga as regras da seção 2; não faça merge nem deploy.`
- PR 3: `Leia docs/handoff-notas.md e execute o PR 3 (remover search_vector das rotas de agente de notes e tasks) seguindo as regras da seção 2.`
- PR 4: `Leia docs/handoff-notas.md e execute o PR 4 (dedupe por URL na ponte Raindrop) seguindo as regras da seção 2.`
- PR 5: `Leia docs/handoff-notas.md e execute o PR 5 (normalizeTag nos caminhos de máquina). Use este mapa de sinônimos aprovado: <COLE O MAPA>. Preserve a barra das tags, como o PR explica. Siga as regras da seção 2.`
