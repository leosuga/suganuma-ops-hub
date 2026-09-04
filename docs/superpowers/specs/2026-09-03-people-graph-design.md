# People Graph — módulo de pessoas, relações e curadoria de convidados

**Data:** 2026-09-03
**Status:** aprovado (design), pendente plano de implementação
**Módulo:** `people` — rota `/people`, migration `0040_people.sql`

---

## 1. Problema

Não existe hoje nenhum lugar no Ops Hub para registrar **pessoas** e, principalmente,
as **incompatibilidades entre elas**. O gatilho concreto é a lista de convidados do
chá de bebê da filha: há conflitos reais entre certas pessoas e a mãe da criança, e
montar a lista de cabeça significa (a) esquecer alguém, (b) convidar duas pessoas que
não podem estar na mesma sala, e (c) não conseguir explicar depois por que alguém
ficou de fora.

O objetivo de longo prazo é uma base de pessoas vitalícia. O chá de bebê é o primeiro
consumidor dela, não o escopo total.

## 2. Decisões de arquitetura

### 2.1 Não é um banco de grafos

Com ordem de grandeza de 10²–10³ pessoas, um graph database (Neo4j, ArcadeDB) é
over-engineering por três ordens de magnitude. O Kùzu — que seria a escolha natural de
"SQLite dos grafos", embarcado e com Cypher — foi **arquivado em out/2025** quando a
Apple adquiriu o time, e está fora de questão para infra nova.

O grafo aqui é um **modelo de dados**, não um motor. Postgres com duas tabelas de
aresta resolve integralmente; travessia multi-hop, se um dia for necessária, sai de
recursive CTE.

### 2.2 Mora no Ops Hub, não em ferramenta separada

O app já tem auth, RLS por `owner_id`, realtime, PWA no celular, export/import,
CommandPalette e MCP. Um projeto SQLite local separado teria menos superfície mas
exigiria reconstruir tudo isso. A contrapartida — julgamentos sobre familiares vivendo
no Supabase self-hosted do VPS — é a mesma superfície de confiança que já guarda dados
de saúde e gravidez. Ver §6 para a contenção específica do campo `reason`.

### 2.3 A aresta de conflito é o produto

O valor não está em armazenar pessoas (uma agenda de contatos faz isso). Está em
tornar o conflito um **dado explícito, direcionado e atribuível**. Quatro escolhas
deliberadas:

- **Direcionada.** `subject_id → object_id`. "X é incômodo para a M." não é a mesma
  informação que "X e M. brigaram". Aresta simétrica joga fora exatamente o que se quer
  registrar.
- **Escopo enumerado, não peso numérico.** Nada de `severity: 0.7`. Um número é
  precisão falsa e indefensável numa conversa real. O enum guarda a **decisão**:
  `nao_convidar`, `convidar_avisar`, `manter_distante`, `condicional`.
- **Dono do veto.** `veto_owner ∈ {eu, parceira, ambos}`. Converte uma discussão
  potencialmente tensa num campo de dados. Qualquer conflito que envolva a mãe da
  criança é decisão dela — o sistema apenas registra de quem é a palavra final.
- **`status` em vez de delete.** Pessoas se acertam. `ativo → resolvido` preserva o
  histórico sem poluir a checagem.

### 2.4 Verificação, não otimização

A v1 **checa** a lista contra as arestas de conflito e reporta violações. Não resolve
alocação de mesas. A literatura de seating chart como CSP (CP-SAT, tabu search) é
sólida, mas chá de bebê raramente tem lugar marcado, e o problema real do usuário é
"não esquecer / não errar", não "particionar de forma ótima". Otimização fica para
uma eventual v2 sobre o mesmo schema.

## 3. Schema — `supabase/migrations/0040_people.sql`

Segue o padrão do projeto: `owner_id` FK para `auth.users`, RLS por `auth.uid()`,
índices explícitos, adição à publication `supabase_realtime`.

```sql
-- person: nós do grafo
create table if not exists person (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users on delete cascade,
  name       text not null,
  nickname   text,
  side       text not null default 'outro'
             check (side in ('leo','parceira','comum','outro')),
  circle     text not null default 'outro'
             check (circle in ('familia_nuclear','familia_extensa','amigos',
                               'trabalho','vizinhos','outro')),
  household  text,                    -- agrupador leve: "Família Suganuma"
  phone      text,
  email      text,
  birthday   date,
  notes      text,
  tags       text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- person_relation: arestas positivas/neutras
create table if not exists person_relation (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  from_person uuid not null references person on delete cascade,
  to_person   uuid not null references person on delete cascade,
  kind        text not null
              check (kind in ('conjuge','filho_de','pai_de','irmao_de',
                              'amigo_de','colega_de','ex_de')),
  note        text,
  created_at  timestamptz not null default now(),
  constraint person_relation_no_self check (from_person <> to_person),
  constraint person_relation_unique unique (owner_id, from_person, to_person, kind)
);

-- person_conflict: arestas de conflito (direcionadas)
create table if not exists person_conflict (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid not null references auth.users on delete cascade,
  subject_id          uuid not null references person on delete cascade,
  object_id           uuid not null references person on delete cascade,
  scope               text not null
                      check (scope in ('nao_convidar','convidar_avisar',
                                       'manter_distante','condicional')),
  condition_person_id uuid references person on delete set null,
  veto_owner          text not null default 'eu'
                      check (veto_owner in ('eu','parceira','ambos')),
  reason              text,           -- CAMPO SENSÍVEL — ver §6
  status              text not null default 'ativo'
                      check (status in ('ativo','resolvido')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint person_conflict_no_self check (subject_id <> object_id),
  constraint person_conflict_condicional_needs_person
    check (scope <> 'condicional' or condition_person_id is not null)
);

-- guest_event / guest_invite: eventos e curadoria da lista
create table if not exists guest_event (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users on delete cascade,
  name       text not null,
  event_date date,
  location   text,
  capacity   int,
  notes      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists guest_invite (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users on delete cascade,
  event_id      uuid not null references guest_event on delete cascade,
  person_id     uuid not null references person on delete cascade,
  status        text not null default 'cogitado'
                check (status in ('cogitado','convidar','convidado',
                                  'confirmado','recusou','vetado')),
  plus_ones     int not null default 0,
  decided_by    text check (decided_by in ('eu','parceira','ambos')),
  decision_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint guest_invite_unique unique (event_id, person_id)
);
```

Índices: `person(owner_id, name)`, `person_relation(owner_id, from_person)`,
`person_conflict(owner_id, status)`, `person_conflict(owner_id, object_id)`,
`guest_invite(owner_id, event_id, status)`.

RLS: `using (owner_id = auth.uid()) with check (owner_id = auth.uid())` nas cinco
tabelas. Realtime: as cinco entram na publication.

### 3.1 `household` como texto, não tabela

Agrupador de conveniência para convidar em bloco ("a casa da tia Rosa inteira").
Uma tabela `household` dedicada resolveria o mesmo com mais cerimônia; a informação
estruturalmente correta (quem é cônjuge de quem, quem é filho de quem) já vive em
`person_relation`. YAGNI aplicado.

## 4. Verificador de conflitos

`src/lib/people/conflicts.ts` — **função pura, sem I/O**, alvo de TDD.

```ts
type Violation = {
  level: "block" | "warn" | "info"
  conflictId: string
  subjectId: string
  objectId: string
  message: string
}

export function checkGuestList(
  invites: { person_id: string; status: string }[],
  conflicts: PersonConflict[],
  people: { id: string; name: string }[],
): Violation[]
```

Considera "na lista" os status `convidar | convidado | confirmado`
(`cogitado`, `recusou` e `vetado` ficam de fora). Só avalia conflitos com
`status = 'ativo'`.

| `scope` | condição | `level` |
|---|---|---|
| `nao_convidar` | subject e object ambos na lista | `block` |
| `condicional` | subject na lista **e** `condition_person_id` na lista | `block` |
| `convidar_avisar` | ambos na lista | `warn` |
| `manter_distante` | ambos na lista | `info` |

A mensagem inclui os nomes e o `veto_owner`, para a tela deixar visível de quem é a
decisão. O `reason` **não** entra na `Violation` — ele é exibido só na ficha do
conflito, sob interação explícita.

## 5. UI

Segue os padrões obrigatórios do projeto: componentes extraídos para
`src/components/people/`, nunca inline na página; `React.memo` + callbacks com args
(`onEdit: (id) => void`, não closures) nas linhas de lista; diálogos via
`dynamic(() => import(...), { ssr: false })`; `SectionErrorBoundary` na página;
primitivos `@base-ui/react` (não Radix).

- **`/people`** — lista de pessoas com filtro por `side`, `circle` e busca por nome.
  `PersonRow` memoizado. `VirtualizedList` se passar de 50 itens.
- **`/people/[id]`** — ficha: dados, relações (com navegação para a pessoa ligada),
  conflitos onde a pessoa é `subject` ou `object`.
- **`/people/events/[id]`** — curadoria da lista. Painel de violações fixo no topo,
  recalculado a cada mudança de status; abaixo, as pessoas agrupadas por `household`
  com o seletor de status inline.
- **Navegação** — `BottomNav` já está no limite de 5 itens fixos; entrada nova vai em
  `HUB_ITEMS` como `{ href: "/people", label: "PPL", desc: "Pessoas" }`, mais
  `Sidebar`, `TopBar` (`"/people": "PEOPLE HUB"`) e `CommandPalette`.

## 6. Privacidade — contenção do campo `reason`

O app tem 38 MCP tools, Agent API, busca híbrida com Qdrant e triagem LLM que envia
conteúdo ao **Ollama Cloud**. `person_conflict.reason` é o campo mais sensível que já
entrou neste banco. Regras da v1:

1. `person_conflict` **fora** do índice Qdrant e **sem** coluna `search_vector`.
   Nenhum caminho de embedding toca essa tabela.
2. MCP expõe exatamente duas tools: `people_search` (dados de contato e relações) e
   `guest_list_check` (retorna `Violation[]`, **sem** `reason`). Nenhuma tool genérica
   de leitura da tabela de conflitos.
3. Nenhuma rota de Agent API para `person_conflict` na v1.
4. Criptografia em repouso do `reason` foi **avaliada e descartada** para a v1: mesma
   superfície de confiança do resto do banco (RLS + service role), custo alto,
   benefício marginal contra o modelo de ameaça real.

## 7. Integração com o app existente

### 7.1 Export/Import — exceção deliberada ao stripping de FK

`importAllData` hoje stripa `id` e zera as FKs listadas em `FK_COLUMNS_TO_STRIP`.
Aplicado a este módulo, um restore devolveria **pessoas soltas, zero relações e zero
conflitos** — perda silenciosa exatamente do dado que não se reconstrói de memória.

Decisão: as cinco tabelas novas entram num conjunto `PRESERVE_ID_TABLES`. Para elas:

- `id` **não** é stripado;
- as FKs intra-módulo (`from_person`, `to_person`, `subject_id`, `object_id`,
  `condition_person_id`, `event_id`, `person_id`) **não** entram em
  `FK_COLUMNS_TO_STRIP`;
- o insert vira `.upsert(chunk, { onConflict: "id" })`, tornando o restore idempotente
  e sem violação de PK ao reimportar por cima.

Justificativa: são FKs **intra-módulo**, não cross-módulo, e o caso de uso real do
import neste app single-user é restore do próprio backup — não migração entre
usuários. `SelectiveImportDialog` reusa os mesmos exports e herda o comportamento.

`IMPORT_ORDER` parent-first: `person → guest_event → person_relation →
person_conflict → guest_invite`. Version do export sobe para `0.4.0`.

### 7.2 Realtime

`TABLE_QUERY_PREFIX` em `src/lib/realtime.ts`:

```
person:          ["people"]
person_relation: ["people"]
person_conflict: ["people"]
guest_event:     ["people"]
guest_invite:    ["people"]
```

Prefixo único porque toda a UI do módulo é uma superfície só; o debounce de 300ms já
colapsa rajadas.

### 7.3 Paginação obrigatória

`PGRST_DB_MAX_ROWS=1000` no PostgREST do VPS trunca **silenciosamente** qualquer
query sem `.range()`. As queries de `person` e `guest_invite` nascem paginadas em
páginas de 1000, mesmo com volume baixo hoje — foi exatamente esse o bug que deixou
`/notes` vazia.

## 8. Testes

- `src/lib/people/conflicts.test.ts` — as 4 regras da tabela em §4, mais: conflito
  `resolvido` ignorado, status `cogitado`/`recusou` fora da checagem, `condicional`
  sem a pessoa-condição na lista não dispara, lista vazia retorna `[]`.
  Função pura, roda no env `node` — sem mocks.
- `tests/schemas.test.ts` — schemas Zod das cinco entidades.

O gate de testes do `deploy.yml` (`npm ci` + `npx vitest run`) já cobre o módulo
automaticamente.

## 9. Ordem de entrega

Migration única (schema completo de uma vez, evita migration sobre migration),
entrega em duas fatias:

**Fatia 1 — resolve o chá de bebê**
Migration + schemas Zod + tipos planos + queries paginadas + verificador com testes +
`/people` (CRUD de pessoa, relação e conflito) + `/people/events/[id]` com o painel de
violações + navegação.

**Fatia 2 — a base amadurece**
Aniversários no calendário, timeline de interações, busca, as duas tools MCP de §6.

## 10. Runbook da migration

Supabase é self-hosted; migrations **não** rodam pelo deploy nem por SQL Editor:

```bash
ssh LeoVM 'docker exec -i supabase-db psql -U supabase_admin -d postgres' \
  < supabase/migrations/0040_people.sql
```

O dono das tabelas é `supabase_admin`, não `postgres`. Depois de aplicar, **validar as
colunas de verdade** (`\d person`, `\d person_conflict`) antes de escrever queries que
as usem — o schema já driftou das migrations neste projeto (coluna `favorited`
inexistente derrubou `/notes` inteira com HTTP 400 silencioso).

Antes do deploy: rodar `npm run build` local **com `tsc` ativo** (sem `SKIP_TSC=1`),
que é o único momento em que os erros de tipo aparecem.

## 11. Fora de escopo (v1)

- Otimização/alocação de mesas (CP-SAT, tabu search)
- Visualização de grafo
- Importação de contatos do telefone/Google
- Timeline de interações e lembretes de aniversário
- Acesso multiusuário — a parceira **não** acessa a ferramenta; o `veto_owner` é
  anotação de quem decide, não permissão de sistema
- Criptografia de `reason` em repouso (§6.4)
