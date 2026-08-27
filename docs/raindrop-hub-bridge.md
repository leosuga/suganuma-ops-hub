# Raindrop → Hub Notes (ponte de curadoria automática) — IMPLEMENTADA ✅

> **Status (2026-08-27)**: implementada, deployada em produção e validada ponta
> a ponta com dados reais. Este doc descreve o que EXISTE (não mais o plano).
> Design original e discussão de variantes: ver conversa Cowork de 2026-08-25 e
> histórico do git (commit `275a19f`).

Ingestão automática de itens salvos no Raindrop.io (collections de conhecimento
técnico) no módulo de Notes do Hub, com classificação por LLM e indexação na
busca semântica (Hybrid RAG). Objetivo: transformar o save no Raindrop em
conhecimento pesquisável no Hub, sem esforço manual.

## 1. Arquitetura (Variante C — híbrida)

```
GitHub Actions (cron semanal, segunda 08:00 BRT) ou workflow_dispatch
        │  HMAC-SHA256 do body "{}" com RAINDROP_SYNC_SECRET
        ▼
POST /api/integrations/raindrop-sync   (src/app/api/integrations/raindrop-sync/route.ts)
        │
        ├─ 1. lê cursor (nota pinned, tag `raindrop-sync-state`, corpo = ISO timestamp)
        ├─ 2. GET Raindrop API por collection-alvo INDIVIDUAL (loop em
        │      RAINDROP_COLLECTION_IDS), `sort=-created` + filtro nativo
        │      `search=created:>YYYY-MM-DD` (cursor − 1 dia)
        ├─ 3. para cada item novo (created > cursor, oldest-first):
        │      a. dedup via `webhook_event` (source='raindrop', key = raindrop _id)
        │      b. LLM classifica: `reference` (guardar/consultar) vs `actionable`
        │         (ação concreta e próxima) — viés para REFERENCE
        │      c. reference  → nota via createNoteWithEmbedding()
        │         (resumo PT + tags [`raindrop`, slug-collection, tags LLM], para: resources)
        │      d. actionable → inbox_item (source='raindrop', content com prefixo [Collection])
        │      e. mark() da idempotência
        └─ 4. cursor = max(created) processado (avança oldest-first, cap por run)
```

**Por que Variante C**: o problema real era *revisão*, não ingestão. Nota-direta
(Variante A) só moveria a pilha do Raindrop pro Notes; inbox-puro (B) afundaria o
Cockpit com material de referência. O classificador decide por item — referência
vira conhecimento pesquisável imediatamente; o acionável entra no fluxo de triagem
que já existia (Cockpit / "TRIAR TUDO").

**Ratio empírico no backlog técnico** (~2.1k itens): viés actionable → 56% no
inbox (errado — pilha movida). Recalibrado com viés reference → **98 notas /
2 inbox**. Lição: validar o ratio com 1 run pequeno antes de varrer o backlog.

**Classificação via LLM (em lote)**: modelo `gpt-oss:20b` na Ollama Cloud
(fallback local `llama3.2` se a cloud falhar), JSON mode, `temperature: 0.2`.
**1 chamada por chunk de 20 itens** (system prompt amortizado — ~20× menos
chamadas/latência que 1 por item). 1 retry por chunk; item sem classificação
válida → fallback (reference, sem resumo). A resposta do endpoint inclui
`llm_calls` para observabilidade.

## 2. Componentes

| Peça | Arquivo |
|---|---|
| Endpoint | `src/app/api/integrations/raindrop-sync/route.ts` |
| Client Raindrop | `src/lib/raindrop.ts` |
| Helper de nota (insert + embedding) | `src/lib/actions/notes.ts` (`createNoteWithEmbedding()`) |
| HMAC parametrizável | `src/lib/webhooks/hmac.ts` (`verifyWebhookHmac(req, body, secretOverride?)`) |
| Workflow cron + dispatch | `.github/workflows/raindrop-sync.yml` |
| Varredura de backlog | `scripts/raindrop-sweep.sh` (loop de `workflow_dispatch` até delta < 100) |
| Migration | `supabase/migrations/0037_raindrop.sql` — `'raindrop'` no check de `inbox_item.source` |

## 3. Fatos da Raindrop API (validados 2026-08-27)

- **Auth**: Test Token (não expira) — `Authorization: Bearer`
- **Listar**: `GET /rest/v1/raindrops/{collectionId}?sort=-created&page=0&perpage=50` (`perpage` máx 50, page 0-based)
- **Filtro nativo de data**: `search=created:>YYYY-MM-DD` (granularidade de DIA —
  a borda do dia é resolvida com cursor−1 dia + filtro client-side por timestamp + dedup)
- **Cada raindrop traz** `collection.$id`, `type` (`article`/`link`/`video`/`document`/`image`/`audio`), `note`, `highlights[]`
- **Pular** `type: image|audio` (sem texto para resumir)
- **Permanent copy** (`GET /raindrop/{id}/cache`): Pro-only, retorna HTML — fora do escopo v1
- **Sem webhook nativo** — cron é o caminho certo

## 4. Cursor e idempotência (zero migration além do check de `source`)

- **Cursor**: nota pinned com tag `raindrop-sync-state` (corpo = ISO timestamp do
  último `created` processado). Parsing defensivo: falha → null → refetch, dedup protege.
- **Dedup**: tabela `webhook_event` (unique `(source, event_key)`) — reusa
  `checkWebhookIdempotency("raindrop", raindrop_id)`. Rodar 2x não duplica nada.

## 5. Configuração

**Secrets no GitHub** (entrar no container apenas no próximo deploy):
`RAINDROP_TOKEN`, `RAINDROP_COLLECTION_IDS` (CSV, 16 collections — Ver Depois /
Entretenimento / unread / Para Processar **excluídas**), `RAINDROP_SYNC_SECRET`,
`RAINDROP_MAX_ITEMS_PER_RUN` (default 100).

**Cron**: `.github/workflows/raindrop-sync.yml` — `schedule: 0 11 * * 1` (segunda
08:00 BRT) + `workflow_dispatch`. Assina HMAC com `openssl dgst -sha256 -hmac`.

## 6. Operação

- **Run manual**: `gh workflow run "Raindrop Sync" --repo leosuga/suganuma-ops-hub`
- **Varredura de backlog**: `bash scripts/raindrop-sweep.sh` (log em `/tmp/raindrop-sweep.log`)
- **Verificação no banco** (SSH no VPS):
  `ssh LeoVM 'docker exec supabase-db psql -U supabase_admin -d postgres'` →
  `select count(*) from note where 'raindrop' = any(tags);`
- **Renomeou collection no Raindrop?** A tag acompanha nos itens NOVOS; histórico
  não é re-tagueado (dedup). Re-tag geral = v2.

## 7. Fora de escopo (v1 → candidatos a v2)

- Reprocessar itens **atualizados** (novo highlight/note muda `lastUpdate`, não `created`) — v1 só ingere itens novos
- Tabela dedicada `integration_cursor` (cursor + dedup estruturados, em vez de nota pinned + webhook_event)
- Re-taguear histórico quando uma collection for renomeada
- Collection "unread" (~3.8k itens) — merece limpeza própria antes de entrar
- Resumo a partir do texto completo (permanent copy, Pro) — excerpt costuma ser meta description fina