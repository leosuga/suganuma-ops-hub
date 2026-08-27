# Raindrop → Hub Notes (ponte de curadoria automática)

Ingestão automática de itens salvos no Raindrop.io (collection "Conhecimento
Técnico") no módulo de Notes do Hub, com resumo gerado por LLM e indexação na
busca semântica já existente. Objetivo: parar de acumular links em IA/LLM/
Agentes/Data Science que nunca são revisados, transformando o save no Raindrop
em conhecimento pesquisável no Hub, sem esforço manual.

Contexto: ver conversa Cowork de 2026-08-25 ("processar conteúdos do
Raindrop"). Fora de escopo aqui: a collection "Ler depois" (pessoal) — essa
fica só no Raindrop, sem ingestão; a solução ali é outra (limite de fila),
não automação.

## 1. Por que reaproveitar `/api/agent/notes` em vez de escrever direto no banco

O índice vetorial das notas só é atualizado de forma confiável passando pela
rota de agente — ela já chama `syncNoteEmbeddingForOwner()` fire-and-forget
no POST/PATCH (ver `docs/backlog-2026-08.md`, item 3, "Notas criadas via API
de agente/MCP não entram no índice vetorial" — já corrigido). Escrever direto
na tabela `note` a partir de um novo endpoint reintroduziria exatamente esse
bug. **Regra: a ingestão do Raindrop deve sempre criar a nota via POST
`/api/agent/notes` (Bearer agent token), nunca via insert direto no Supabase.**

## 2. Arquitetura

```
GitHub Actions (cron semanal, mesmo horário da revisão semanal do Cowork)
        │
        ▼
POST /api/integrations/raindrop-sync   (novo endpoint, no próprio Hub)
        │
        ├─ 1. lê último cursor sincronizado (tabela/tabela de estado — ver §4)
        ├─ 2. GET Raindrop API: itens da collection "Conhecimento Técnico"
        │      criados/atualizados desde o cursor, ordenados por -created
        ├─ 3. para cada item novo:
        │      a. checa duplicidade (nota existente com esse raindrop_id ou URL)
        │      b. chama LLM: resumo + pontos-chave + tags a partir de
        │         título + excerpt/highlights do Raindrop
        │      c. POST /api/agent/notes (Bearer ops_ token) com o resumo,
        │         link original, tags (`raindrop`, + tema: `llm`/`ia-agents`/
        │         `data-science`/etc.)
        └─ 4. atualiza o cursor com o timestamp mais recente processado
```

## 3. Raindrop API — o que usar

Fonte: `https://developer.raindrop.io/`.

- **Auth**: Test Token (Settings → Integrations → For Developers → Create
  test token, em raindrop.io) — suficiente para uso single-user, evita o
  fluxo OAuth completo. Guardar como secret no GitHub Actions
  (`RAINDROP_TOKEN`), nunca commitado.
- **Listar itens de uma collection**: `GET /rest/v1/raindrops/{collectionId}`
  com `sort=-created` e paginação (`page`, `perpage`). Filtrar client-side
  por `created > cursor` (a API não tem filtro nativo de "desde data" — trazer
  as páginas mais recentes e parar quando cruzar o cursor).
- **ID da collection "Conhecimento Técnico"**: pegar via
  `GET /rest/v1/collections` uma vez, e fixar o ID em env var
  (`RAINDROP_COLLECTION_ID`) — não tem por que resolver isso em runtime toda
  vez.
- Campos relevantes de cada raindrop: `title`, `excerpt`, `link`, `tags`,
  `created`, `_id`, e (se existir) `highlights[]` — highlights dão contexto
  melhor pro resumo do que só o excerpt.

## 4. Estado / cursor de sincronização

Precisa de um lugar para guardar "último `created` processado" — evita
reprocessar tudo a cada run. Duas opções, na ordem de preferência:

1. **Reaproveitar o padrão de nota fixada** (mesmo truque já usado para o
   snapshot do LinkedIn Job Tracker no Hub) — uma nota pinned com tag
   `raindrop-sync-state`, cujo corpo guarda o último timestamp processado.
   Zero migration nova, mas frágil se o parsing do corpo falhar.
2. **Tabela pequena dedicada** (`integration_cursor` ou reaproveitar alguma
   tabela de config genérica se já existir uma no schema) — mais robusto,
   exige uma migration. Preferir esta opção se já existir algo parecido no
   schema (checar antes de criar tabela nova); senão, a opção 1 é aceitável
   para v1.

## 5. Endpoint novo: `POST /api/integrations/raindrop-sync`

- Protegido por secret dedicado (`RAINDROP_SYNC_SECRET`), **não** o
  `WEBHOOK_SECRET` compartilhado — o backlog já sinalizou (item 2,
  "Webhooks: secret único compartilhado") que secret compartilhado entre
  integrações é uma falha a evitar daqui pra frente, não repetir aqui.
- `owner_id` fixo via env var (mesmo padrão de `WEBHOOK_OWNER_ID` já usado
  nos outros webhooks), nunca vindo do payload.
- Chamado só pelo GitHub Actions cron (não expor publicamente sem necessidade;
  se possível restringir por IP/origin do runner, senão o secret já é a
  proteção principal).
- Idempotente: rodar duas vezes seguidas não deve duplicar notas (checar por
  `raindrop_id` ou URL antes de criar).

## 6. Resumo via LLM

- Prompt fixo, por item: título + URL + excerpt/highlights → devolver JSON
  `{ resumo: string, pontos_chave: string[], tags: string[] }`.
- Usar o mesmo provedor de LLM que o Hub já usa em outro lugar do backend, se
  houver um já configurado (evita adicionar uma nova API key/dependência só
  pra isso) — **verificar isso no código antes de escolher provedor**; se não
  houver nenhum, é a única decisão de infraestrutura nova que este projeto
  introduz.
- Se o conteúdo não for extraível (vídeo, PDF, paywall) — não falhar o item
  inteiro: criar a nota só com título + tags + link, sem resumo, e seguir.

## 7. Trigger

- **v1 simples**: GitHub Actions `schedule:` cron, mesma cadência da revisão
  semanal do Cowork (segunda de manhã) — mantém tudo em um ritmo só.
- Não depende de nenhuma automação do Cowork — é 100% dentro do Hub, sem
  precisar de sessão do Claude rodando.

## 8. Fora de escopo (v1)

- Ingestão da collection "Ler depois" (pessoal) — não deve ser processada por
  IA; fica só no Raindrop com a regra de teto de fila.
- Sincronização em tempo real (webhook do Raindrop, se existir) — cron
  semanal já resolve o problema atual; tempo real é otimização prematura.
- Deduplicação semântica entre notas (dois links diferentes sobre o mesmo
  assunto) — a busca semântica já existente no Hub cobre isso na hora de
  consultar, não precisa resolver na ingestão.

## 9. Ordem sugerida de implementação

1. Gerar Test Token no Raindrop; achar o ID da collection "Conhecimento
   Técnico"; separar as collections no Raindrop (se ainda não estiverem
   separadas — ver conversa de 2026-08-25).
2. Endpoint `/api/integrations/raindrop-sync` com auth por secret dedicado +
   leitura do cursor + chamada à API do Raindrop (sem LLM ainda — só criar
   notas com título+link+tags, pra validar o pipeline de ponta a ponta).
3. Adicionar o passo de resumo via LLM.
4. Cron no GitHub Actions.
5. Rodar uma vez manualmente contra os itens acumulados hoje (backlog
   inicial), depois deixar o cron cuidar do resto.
