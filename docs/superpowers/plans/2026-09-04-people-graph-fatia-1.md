# People Graph — Fatia 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar o módulo `people` no Ops Hub — cadastro de pessoas, relações e conflitos, mais a curadoria de lista de convidados com verificação automática de conflitos.

**Architecture:** Cinco tabelas novas no Supabase self-hosted seguindo o pipeline padrão do projeto (migration → Zod → tipos planos → queries TanStack → componentes → página → navegação). O núcleo é `checkGuestList()`, função pura sem I/O que traduz arestas de conflito em violações — é o único ponto do app que interpreta `invite_policy`.

**Tech Stack:** Next.js 16.2.6 (App Router, 100% client-side), React 19.2.6, Zod 4.3.6, Tailwind v4, `@base-ui/react` (**não** Radix), TanStack Query v5, Supabase self-hosted (Postgres + PostgREST + Realtime), Vitest 4.1.5.

**Spec:** [`docs/superpowers/specs/2026-09-03-people-graph-design.md`](../specs/2026-09-03-people-graph-design.md)

## Global Constraints

Estas regras valem para **todas** as tarefas. Elas vêm do `AGENTS.md` e de bugs reais de produção deste projeto — não são preferências de estilo.

- **`@base-ui/react`, não Radix.** `Dialog` usa `open` (boolean) + `onOpenChange={(v) => setState(v)}`. `Checkbox` usa `checked` + `onCheckedChange`.
- **`cn()` de `@/lib/utils`** para toda classe condicional.
- **Client components** usam `createClient()` de `@/lib/supabase/client` (sync). Todo arquivo de página/componente começa com `"use client"`.
- **Campos de DB (`owner_id`, `created_at`, `updated_at`) NÃO entram no schema Zod** — entram no tipo da mutation.
- **Paginação obrigatória:** `PGRST_DB_MAX_ROWS=1000` trunca **silenciosamente** toda query sem `.range()`. Toda query de tabela que pode crescer pagina em blocos de 1000.
- **Sempre checar `.error`** de toda chamada Supabase, inclusive dentro de `Promise.all`.
- **`React.memo` + callbacks com args** em componentes de lista: `onEdit: (id: string) => void`, nunca closures `() => handler(item.id)` no parent.
- **Componentes nunca inline na página** — sempre extraídos para `src/components/people/`.
- **Diálogos via `dynamic()`** com `{ ssr: false }`.
- **`useMemo`** para filtering, sorting e construção de `Set`.
- **`useEffect` com deps primitivas** (`[p?.id, p?.name]`), nunca com o objeto (`[person]`).
- **Migrations rodam via SSH**, nunca pelo deploy: `ssh LeoVM 'docker exec -i supabase-db psql -U supabase_admin -d postgres' < arquivo.sql`. O owner é `supabase_admin`, **não** `postgres`.
- **`npm test`** roda só os testes node (é o que este plano usa). Testes `.test.tsx` (DOM) exigem `npm run test:docker` e **não** fazem parte desta fatia.
- **Não criar `loading.tsx`** — o app é 100% client-side, não usa RSC.
- **Não adicionar job `typecheck`** ao workflow.
- **Acentuação:** revisar todo arquivo escrito — o write tool ocasionalmente grava o escape Unicode literal (a sequência `ç`, seis caracteres) em vez do `ç`. Verificar com `grep -c 'u00' <arquivo>` (esperado: `0`).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Task |
|---|---|---|
| `supabase/migrations/0040_people.sql` | DDL das 5 tabelas + RLS + índices + realtime | 1 |
| `src/lib/types/people.ts` | Tipos planos `Row`/`Insert` das 5 tabelas | 2 |
| `src/lib/schemas/people.ts` | Schemas Zod (validação de formulário) | 2 |
| `src/lib/people/conflicts.ts` | `checkGuestList()` — **único** intérprete de `invite_policy` | 3 |
| `src/lib/people/conflicts.test.ts` | Testes do verificador | 3 |
| `src/lib/queries/people.ts` | `queryOptions` + hooks TanStack, paginados | 4 |
| `src/lib/export-import.ts` | +5 tabelas, `PRESERVE_ID_TABLES`, upsert | 5 |
| `src/lib/import-clean.ts` | `cleanRowsForImport()` — helper puro extraído | 5 |
| `tests/import-clean.test.ts` | Testes do helper de import | 5 |
| `src/lib/realtime.ts` | +5 entradas em `TABLE_QUERY_PREFIX` | 4 |
| `src/components/people/PersonRow.tsx` | Linha da lista de pessoas (memo) | 6 |
| `src/components/people/PersonFormDialog.tsx` | Criar/editar pessoa | 6 |
| `src/components/people/ConflictFormDialog.tsx` | Criar/editar conflito | 7 |
| `src/components/people/RelationFormDialog.tsx` | Criar relação | 7 |
| `src/components/people/ViolationPanel.tsx` | Painel de violações do evento | 8 |
| `src/components/people/InviteRow.tsx` | Linha de convite com seletor de status | 8 |
| `src/app/(app)/people/page.tsx` | Lista de pessoas | 6 |
| `src/app/(app)/people/[id]/page.tsx` | Ficha da pessoa | 7 |
| `src/app/(app)/people/events/[id]/page.tsx` | Curadoria da lista | 8 |
| `src/components/shell/{BottomNav,Sidebar,TopBar,CommandPalette}.tsx` | Navegação | 9 |

---

### Task 1: Migration `0040_people.sql`

**Files:**
- Create: `supabase/migrations/0040_people.sql`

**Interfaces:**
- Consumes: nada (primeira tarefa)
- Produces: as tabelas `person`, `person_relation`, `person_conflict`, `guest_event`, `guest_invite` no banco de produção, com as colunas exatamente como escritas abaixo. Todas as tarefas seguintes dependem desses nomes.

- [ ] **Step 1: Escrever a migration**

Criar `supabase/migrations/0040_people.sql` com exatamente este conteúdo:

```sql
-- People Graph — pessoas, relações, conflitos e curadoria de convidados.
--
-- O coração é person_conflict, e ela tem DOIS eixos independentes:
--   invite_policy → "essa pessoa vem?"
--   handling      → "o que eu faço se os dois vierem?"
-- Um enum único misturava as duas perguntas e tornava inexprimível a
-- combinação real "convidar, avisar antes E separar no dia".
-- Ver docs/superpowers/specs/2026-09-03-people-graph-design.md §2.5.

-- ---------------------------------------------------------------- person
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
  household  text,
  phone      text,
  email      text,
  birthday   date,
  notes      text,
  tags       text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_person_owner_name on person(owner_id, name);
create index if not exists idx_person_owner_household on person(owner_id, household);

alter table person enable row level security;
drop policy if exists "person_owner" on person;
create policy "person_owner" on person
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ------------------------------------------------------- person_relation
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

create index if not exists idx_person_relation_from on person_relation(owner_id, from_person);
create index if not exists idx_person_relation_to on person_relation(owner_id, to_person);

alter table person_relation enable row level security;
drop policy if exists "person_relation_owner" on person_relation;
create policy "person_relation_owner" on person_relation
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ------------------------------------------------------- person_conflict
create table if not exists person_conflict (
  id                 uuid primary key default gen_random_uuid(),
  owner_id           uuid not null references auth.users on delete cascade,
  subject_id         uuid not null references person on delete cascade,
  object_id          uuid not null references person on delete cascade,
  invite_policy      text not null
                     check (invite_policy in ('excluir_um','nao_juntos','ok_com_ressalva')),
  excluded_person_id uuid references person on delete cascade,
  handling           text[] not null default '{}',
  veto_owner         text not null default 'eu'
                     check (veto_owner in ('eu','parceira','ambos')),
  reason             text,
  status             text not null default 'ativo'
                     check (status in ('ativo','resolvido')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint person_conflict_no_self check (subject_id <> object_id),
  -- excluir_um exige saber QUEM sai, e quem sai tem que ser uma das duas
  -- pontas. Nomear o excluído pela posição na aresta ("o subject") faria a
  -- correção do dado depender da ordem de digitação.
  constraint person_conflict_excluir_um_needs_person
    check (invite_policy <> 'excluir_um' or excluded_person_id is not null),
  constraint person_conflict_excluded_is_an_endpoint
    check (excluded_person_id is null
           or excluded_person_id in (subject_id, object_id)),
  constraint person_conflict_handling_values
    check (handling <@ array['avisar_antes','separar_no_evento']::text[])
);

create index if not exists idx_person_conflict_owner_status on person_conflict(owner_id, status);
create index if not exists idx_person_conflict_subject on person_conflict(owner_id, subject_id);
create index if not exists idx_person_conflict_object on person_conflict(owner_id, object_id);

alter table person_conflict enable row level security;
drop policy if exists "person_conflict_owner" on person_conflict;
create policy "person_conflict_owner" on person_conflict
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ----------------------------------------------------------- guest_event
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

create index if not exists idx_guest_event_owner_date on guest_event(owner_id, event_date desc);

alter table guest_event enable row level security;
drop policy if exists "guest_event_owner" on guest_event;
create policy "guest_event_owner" on guest_event
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ---------------------------------------------------------- guest_invite
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

create index if not exists idx_guest_invite_event on guest_invite(owner_id, event_id, status);

alter table guest_invite enable row level security;
drop policy if exists "guest_invite_owner" on guest_invite;
create policy "guest_invite_owner" on guest_invite
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- -------------------------------------------------------------- realtime
-- add table falha se a tabela já estiver na publication; o bloco torna a
-- migration re-executável (necessário: o remédio para schema drift neste
-- projeto é rodar a migration de novo).
do $$
declare t text;
begin
  foreach t in array array['person','person_relation','person_conflict',
                           'guest_event','guest_invite']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;
```

- [ ] **Step 2: Verificar acentuação do arquivo**

Run: `grep -c 'u00' supabase/migrations/0040_people.sql`
Expected: `0`

- [ ] **Step 3: Aplicar a migration no VPS**

Run:
```bash
ssh LeoVM 'docker exec -i supabase-db psql -U supabase_admin -d postgres' < supabase/migrations/0040_people.sql
```
Expected: sequência de `CREATE TABLE`, `CREATE INDEX`, `ALTER TABLE`, `CREATE POLICY`, `DO`. Nenhum `ERROR`.

Se aparecer `must be owner of table`, o usuário está errado — é `supabase_admin`, não `postgres`.

- [ ] **Step 4: Validar o schema REAL (não confiar na migration)**

Run:
```bash
ssh LeoVM "docker exec -i supabase-db psql -U supabase_admin -d postgres -c '\\d person_conflict'"
```
Expected: a saída lista `invite_policy`, `excluded_person_id`, `handling` e as três constraints (`person_conflict_excluir_um_needs_person`, `person_conflict_excluded_is_an_endpoint`, `person_conflict_handling_values`).

**Este passo não é burocracia.** O schema deste projeto já driftou das migrations antes — a coluna `favorited` não existia no banco e derrubou `/notes` inteira com um HTTP 400 silencioso do PostgREST. Se qualquer coluna faltar aqui, pare e investigue antes de seguir.

- [ ] **Step 5: Validar que as constraints realmente barram dado inválido**

Run:
```bash
ssh LeoVM "docker exec -i supabase-db psql -U supabase_admin -d postgres -c \"insert into person_conflict (owner_id, subject_id, object_id, invite_policy) values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'excluir_um')\""
```
Expected: `ERROR` — pode ser violação de FK (`owner_id`/`subject_id` inexistentes) **ou** de `person_conflict_excluir_um_needs_person`. Qualquer erro serve: o que importa é que **não** insere. Se retornar `INSERT 0 1`, as constraints não foram aplicadas — pare.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0040_people.sql
git commit -m "feat(people): migration 0040 — pessoas, relações, conflitos e convites

invite_policy + handling em dois eixos; excluded_person_id explícito
com constraint de ser uma das pontas da aresta.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Tipos planos e schemas Zod

**Files:**
- Create: `src/lib/types/people.ts`
- Create: `src/lib/schemas/people.ts`
- Modify: `src/lib/types/index.ts`
- Modify: `tests/schemas.test.ts`

**Interfaces:**
- Consumes: os nomes de coluna da Task 1.
- Produces:
  - Tipos: `PersonRow`, `PersonInsert`, `PersonRelationRow`, `PersonConflictRow`, `GuestEventRow`, `GuestInviteRow`, `InvitePolicy`, `ConflictHandling`, `PersonSide`, `PersonCircle`, `VetoOwner`, `InviteStatus`
  - Schemas: `personSchema`, `personRelationSchema`, `personConflictSchema`, `guestEventSchema`, `guestInviteSchema`
  - Tipos inferidos: `Person`, `PersonRelation`, `PersonConflict`, `GuestEvent`, `GuestInvite`

- [ ] **Step 1: Escrever os tipos planos**

Criar `src/lib/types/people.ts`:

```ts
export type PersonSide = "leo" | "parceira" | "comum" | "outro"
export type PersonCircle =
  | "familia_nuclear"
  | "familia_extensa"
  | "amigos"
  | "trabalho"
  | "vizinhos"
  | "outro"
export type RelationKind =
  | "conjuge"
  | "filho_de"
  | "pai_de"
  | "irmao_de"
  | "amigo_de"
  | "colega_de"
  | "ex_de"
export type InvitePolicy = "excluir_um" | "nao_juntos" | "ok_com_ressalva"
export type ConflictHandling = "avisar_antes" | "separar_no_evento"
export type VetoOwner = "eu" | "parceira" | "ambos"
export type ConflictStatus = "ativo" | "resolvido"
export type InviteStatus =
  | "cogitado"
  | "convidar"
  | "convidado"
  | "confirmado"
  | "recusou"
  | "vetado"

export interface PersonRow {
  id: string
  owner_id: string
  name: string
  nickname: string | null
  side: PersonSide
  circle: PersonCircle
  household: string | null
  phone: string | null
  email: string | null
  birthday: string | null
  notes: string | null
  tags: string[]
  created_at: string
  updated_at: string
}

export interface PersonInsert {
  id?: string
  owner_id: string
  name: string
  nickname?: string | null
  side?: PersonSide
  circle?: PersonCircle
  household?: string | null
  phone?: string | null
  email?: string | null
  birthday?: string | null
  notes?: string | null
  tags?: string[]
}

export interface PersonRelationRow {
  id: string
  owner_id: string
  from_person: string
  to_person: string
  kind: RelationKind
  note: string | null
  created_at: string
}

export interface PersonConflictRow {
  id: string
  owner_id: string
  subject_id: string
  object_id: string
  invite_policy: InvitePolicy
  excluded_person_id: string | null
  handling: ConflictHandling[]
  veto_owner: VetoOwner
  reason: string | null
  status: ConflictStatus
  created_at: string
  updated_at: string
}

export interface GuestEventRow {
  id: string
  owner_id: string
  name: string
  event_date: string | null
  location: string | null
  capacity: number | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface GuestInviteRow {
  id: string
  owner_id: string
  event_id: string
  person_id: string
  status: InviteStatus
  plus_ones: number
  decided_by: VetoOwner | null
  decision_note: string | null
  created_at: string
  updated_at: string
}
```

- [ ] **Step 2: Reexportar no barrel de tipos**

Em `src/lib/types/index.ts`, adicionar ao final:

```ts
export type {
  PersonRow,
  PersonInsert,
  PersonRelationRow,
  PersonConflictRow,
  GuestEventRow,
  GuestInviteRow,
  PersonSide,
  PersonCircle,
  RelationKind,
  InvitePolicy,
  ConflictHandling,
  VetoOwner,
  ConflictStatus,
  InviteStatus,
} from "./people"
```

- [ ] **Step 3: Escrever o teste dos schemas (falha primeiro)**

Adicionar ao final de `tests/schemas.test.ts` (mantendo os imports existentes no topo do arquivo e acrescentando o import novo junto deles):

```ts
import {
  personSchema,
  personConflictSchema,
  guestInviteSchema,
} from "@/lib/schemas/people"

describe("people schemas", () => {
  it("aceita uma pessoa mínima e aplica os defaults", () => {
    const parsed = personSchema.parse({ name: "Tia Rosa" })
    expect(parsed.side).toBe("outro")
    expect(parsed.circle).toBe("outro")
    expect(parsed.tags).toEqual([])
  })

  it("rejeita pessoa sem nome", () => {
    expect(personSchema.safeParse({ name: "" }).success).toBe(false)
  })

  it("exige excluded_person_id quando invite_policy é excluir_um", () => {
    const semExcluido = personConflictSchema.safeParse({
      subject_id: "11111111-1111-1111-1111-111111111111",
      object_id: "22222222-2222-2222-2222-222222222222",
      invite_policy: "excluir_um",
    })
    expect(semExcluido.success).toBe(false)
  })

  it("aceita excluir_um com o excluído sendo uma das pontas", () => {
    const ok = personConflictSchema.safeParse({
      subject_id: "11111111-1111-1111-1111-111111111111",
      object_id: "22222222-2222-2222-2222-222222222222",
      invite_policy: "excluir_um",
      excluded_person_id: "11111111-1111-1111-1111-111111111111",
    })
    expect(ok.success).toBe(true)
  })

  it("rejeita excluído que não é subject nem object", () => {
    const forasteiro = personConflictSchema.safeParse({
      subject_id: "11111111-1111-1111-1111-111111111111",
      object_id: "22222222-2222-2222-2222-222222222222",
      invite_policy: "excluir_um",
      excluded_person_id: "33333333-3333-3333-3333-333333333333",
    })
    expect(forasteiro.success).toBe(false)
  })

  it("rejeita conflito de uma pessoa com ela mesma", () => {
    const mesmo = personConflictSchema.safeParse({
      subject_id: "11111111-1111-1111-1111-111111111111",
      object_id: "11111111-1111-1111-1111-111111111111",
      invite_policy: "nao_juntos",
    })
    expect(mesmo.success).toBe(false)
  })

  it("aceita handling combinado", () => {
    const parsed = personConflictSchema.parse({
      subject_id: "11111111-1111-1111-1111-111111111111",
      object_id: "22222222-2222-2222-2222-222222222222",
      invite_policy: "ok_com_ressalva",
      handling: ["avisar_antes", "separar_no_evento"],
    })
    expect(parsed.handling).toHaveLength(2)
  })

  it("convite nasce como cogitado", () => {
    const parsed = guestInviteSchema.parse({
      event_id: "11111111-1111-1111-1111-111111111111",
      person_id: "22222222-2222-2222-2222-222222222222",
    })
    expect(parsed.status).toBe("cogitado")
    expect(parsed.plus_ones).toBe(0)
  })
})
```

- [ ] **Step 4: Rodar o teste para ver falhar**

Run: `npm test -- tests/schemas.test.ts`
Expected: FAIL — `Cannot find module '@/lib/schemas/people'`.

- [ ] **Step 5: Escrever os schemas Zod**

Criar `src/lib/schemas/people.ts`. Note que `owner_id`, `created_at` e `updated_at` **não** entram (padrão do projeto — vão no tipo da mutation):

```ts
import { z } from "zod"

export const personSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  nickname: z.string().max(100).optional().nullable(),
  side: z.enum(["leo", "parceira", "comum", "outro"]).default("outro"),
  circle: z
    .enum([
      "familia_nuclear",
      "familia_extensa",
      "amigos",
      "trabalho",
      "vizinhos",
      "outro",
    ])
    .default("outro"),
  household: z.string().max(200).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().max(200).optional().nullable(),
  birthday: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
  tags: z.array(z.string()).default([]),
})

export const personRelationSchema = z
  .object({
    id: z.string().uuid().optional(),
    from_person: z.string().uuid(),
    to_person: z.string().uuid(),
    kind: z.enum([
      "conjuge",
      "filho_de",
      "pai_de",
      "irmao_de",
      "amigo_de",
      "colega_de",
      "ex_de",
    ]),
    note: z.string().max(1000).optional().nullable(),
  })
  .refine((r) => r.from_person !== r.to_person, {
    message: "Uma pessoa não se relaciona consigo mesma",
    path: ["to_person"],
  })

export const personConflictSchema = z
  .object({
    id: z.string().uuid().optional(),
    subject_id: z.string().uuid(),
    object_id: z.string().uuid(),
    invite_policy: z.enum(["excluir_um", "nao_juntos", "ok_com_ressalva"]),
    excluded_person_id: z.string().uuid().optional().nullable(),
    handling: z.array(z.enum(["avisar_antes", "separar_no_evento"])).default([]),
    veto_owner: z.enum(["eu", "parceira", "ambos"]).default("eu"),
    reason: z.string().max(5000).optional().nullable(),
    status: z.enum(["ativo", "resolvido"]).default("ativo"),
  })
  .refine((c) => c.subject_id !== c.object_id, {
    message: "Um conflito precisa de duas pessoas diferentes",
    path: ["object_id"],
  })
  // Espelha person_conflict_excluir_um_needs_person no banco: a UI dá o erro
  // antes do round-trip, o banco garante que nada entra por outro caminho.
  .refine(
    (c) => c.invite_policy !== "excluir_um" || !!c.excluded_person_id,
    {
      message: "Escolha quem fica de fora",
      path: ["excluded_person_id"],
    },
  )
  // Espelha person_conflict_excluded_is_an_endpoint.
  .refine(
    (c) =>
      !c.excluded_person_id ||
      c.excluded_person_id === c.subject_id ||
      c.excluded_person_id === c.object_id,
    {
      message: "Quem fica de fora tem que ser uma das duas pessoas do conflito",
      path: ["excluded_person_id"],
    },
  )

export const guestEventSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(200),
  event_date: z.string().optional().nullable(),
  location: z.string().max(300).optional().nullable(),
  capacity: z.number().int().positive().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
})

export const guestInviteSchema = z.object({
  id: z.string().uuid().optional(),
  event_id: z.string().uuid(),
  person_id: z.string().uuid(),
  status: z
    .enum(["cogitado", "convidar", "convidado", "confirmado", "recusou", "vetado"])
    .default("cogitado"),
  plus_ones: z.number().int().min(0).default(0),
  decided_by: z.enum(["eu", "parceira", "ambos"]).optional().nullable(),
  decision_note: z.string().max(2000).optional().nullable(),
})

export type Person = z.infer<typeof personSchema>
export type PersonRelation = z.infer<typeof personRelationSchema>
export type PersonConflict = z.infer<typeof personConflictSchema>
export type GuestEvent = z.infer<typeof guestEventSchema>
export type GuestInvite = z.infer<typeof guestInviteSchema>
```

- [ ] **Step 6: Rodar o teste para ver passar**

Run: `npm test -- tests/schemas.test.ts`
Expected: PASS — 38 testes anteriores + 8 novos.

- [ ] **Step 7: Verificar acentuação**

Run: `grep -c 'u00' src/lib/schemas/people.ts src/lib/types/people.ts`
Expected: `0` para os dois arquivos.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types/people.ts src/lib/types/index.ts src/lib/schemas/people.ts tests/schemas.test.ts
git commit -m "feat(people): tipos planos e schemas Zod

Os refines de personConflictSchema espelham as check constraints da
migration 0040 — validação na UI antes do round-trip, banco como rede.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: O verificador de conflitos (TDD)

Esta é a tarefa mais importante do plano. É a única função do app que interpreta `invite_policy` — é o que mantém barata a extração futura da política para outro domínio (spec §2.5).

**Files:**
- Create: `src/lib/people/conflicts.ts`
- Create: `src/lib/people/conflicts.test.ts`

**Interfaces:**
- Consumes: `PersonRow`, `PersonConflictRow`, `GuestInviteRow` de `@/lib/types` (Task 2)
- Produces:
  - `type ViolationLevel = "block" | "warn" | "info"`
  - `interface Violation { level, conflictId, subjectId, objectId, excludedId, message }`
  - `function checkGuestList(invites, conflicts, people): Violation[]`
  - `const ON_LIST_STATUSES: Set<string>`

- [ ] **Step 1: Escrever os testes (todos falham)**

Criar `src/lib/people/conflicts.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { checkGuestList } from "./conflicts"
import type { PersonConflictRow } from "@/lib/types"

const ANA = "11111111-1111-1111-1111-111111111111"
const BIA = "22222222-2222-2222-2222-222222222222"
const CAI = "33333333-3333-3333-3333-333333333333"

const people = [
  { id: ANA, name: "Ana" },
  { id: BIA, name: "Bia" },
  { id: CAI, name: "Caio" },
]

function conflito(over: Partial<PersonConflictRow>): PersonConflictRow {
  return {
    id: "c1",
    owner_id: "owner",
    subject_id: ANA,
    object_id: BIA,
    invite_policy: "nao_juntos",
    excluded_person_id: null,
    handling: [],
    veto_owner: "eu",
    reason: "briga de 2019",
    status: "ativo",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  }
}

function convites(pares: [string, string][]) {
  return pares.map(([person_id, status]) => ({ person_id, status }))
}

describe("checkGuestList", () => {
  it("retorna vazio quando não há convites", () => {
    expect(checkGuestList([], [conflito({})], people)).toEqual([])
  })

  it("bloqueia nao_juntos quando os dois estão na lista", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "confirmado"]]),
      [conflito({})],
      people,
    )
    expect(v).toHaveLength(1)
    expect(v[0].level).toBe("block")
    expect(v[0].message).toContain("Ana")
    expect(v[0].message).toContain("Bia")
  })

  it("não acusa nao_juntos quando só um está na lista", () => {
    const v = checkGuestList(convites([[ANA, "convidar"]]), [conflito({})], people)
    expect(v).toEqual([])
  })

  it("ignora conflito resolvido", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ status: "resolvido" })],
      people,
    )
    expect(v).toEqual([])
  })

  it("ignora cogitado, recusou e vetado", () => {
    for (const status of ["cogitado", "recusou", "vetado"]) {
      const v = checkGuestList(
        convites([[ANA, "convidar"], [BIA, status]]),
        [conflito({})],
        people,
      )
      expect(v).toEqual([])
    }
  })

  it("bloqueia excluir_um quando as duas pontas estão na lista", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ invite_policy: "excluir_um", excluded_person_id: ANA })],
      people,
    )
    expect(v).toHaveLength(1)
    expect(v[0].level).toBe("block")
    expect(v[0].excludedId).toBe(ANA)
    expect(v[0].message).toContain("Ana")
  })

  it("não acusa excluir_um quando a outra ponta está fora", () => {
    // Caso real: a pessoa PODE ir a eventos onde a outra não esteja.
    const v = checkGuestList(
      convites([[ANA, "convidar"]]),
      [conflito({ invite_policy: "excluir_um", excluded_person_id: ANA })],
      people,
    )
    expect(v).toEqual([])
  })

  it("ok_com_ressalva sem handling não gera violação", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ invite_policy: "ok_com_ressalva", handling: [] })],
      people,
    )
    expect(v).toEqual([])
  })

  it("ok_com_ressalva com avisar_antes gera warn", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ invite_policy: "ok_com_ressalva", handling: ["avisar_antes"] })],
      people,
    )
    expect(v).toHaveLength(1)
    expect(v[0].level).toBe("warn")
  })

  it("ok_com_ressalva com os dois handling gera 2 violações", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [
        conflito({
          invite_policy: "ok_com_ressalva",
          handling: ["avisar_antes", "separar_no_evento"],
        }),
      ],
      people,
    )
    expect(v).toHaveLength(2)
    expect(v.map((x) => x.level).sort()).toEqual(["info", "warn"])
  })

  it("ordena block antes de warn antes de info", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"], [CAI, "convidar"]]),
      [
        conflito({
          id: "c-info",
          subject_id: BIA,
          object_id: CAI,
          invite_policy: "ok_com_ressalva",
          handling: ["separar_no_evento"],
        }),
        conflito({ id: "c-block", invite_policy: "nao_juntos" }),
      ],
      people,
    )
    expect(v.map((x) => x.level)).toEqual(["block", "info"])
  })

  it("não quebra com pessoa desconhecida na lista de nomes", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({})],
      [{ id: ANA, name: "Ana" }],
    )
    expect(v).toHaveLength(1)
    expect(v[0].message).toContain("desconhecid")
  })

  it("nunca inclui o reason na violação", () => {
    const v = checkGuestList(
      convites([[ANA, "convidar"], [BIA, "convidar"]]),
      [conflito({ reason: "segredo de família" })],
      people,
    )
    expect(JSON.stringify(v)).not.toContain("segredo")
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- src/lib/people/conflicts.test.ts`
Expected: FAIL — `Cannot find module './conflicts'`.

- [ ] **Step 3: Implementar o verificador**

Criar `src/lib/people/conflicts.ts`:

```ts
import type { PersonConflictRow, VetoOwner } from "@/lib/types"

export type ViolationLevel = "block" | "warn" | "info"

export interface Violation {
  level: ViolationLevel
  conflictId: string
  subjectId: string
  objectId: string
  /** Preenchido só em excluir_um: quem a decisão manda deixar de fora. */
  excludedId: string | null
  vetoOwner: VetoOwner
  message: string
}

/**
 * Status que contam como "está na lista". `cogitado` ainda não é convite,
 * `recusou` e `vetado` já saíram — nenhum dos três gera conflito.
 */
export const ON_LIST_STATUSES: ReadonlySet<string> = new Set([
  "convidar",
  "convidado",
  "confirmado",
])

const LEVEL_ORDER: Record<ViolationLevel, number> = {
  block: 0,
  warn: 1,
  info: 2,
}

/**
 * Único ponto do app que interpreta `invite_policy` e `handling`.
 * Componentes recebem Violation[] pronto e nunca fazem switch sobre a
 * política — é isso que mantém barata a extração futura dessa política
 * para outro domínio (spec §2.5).
 *
 * O campo `reason` do conflito NUNCA entra na Violation: é o dado mais
 * sensível do módulo e só aparece na ficha, sob interação explícita.
 */
export function checkGuestList(
  invites: { person_id: string; status: string }[],
  conflicts: PersonConflictRow[],
  people: { id: string; name: string }[],
): Violation[] {
  const onList = new Set(
    invites.filter((i) => ON_LIST_STATUSES.has(i.status)).map((i) => i.person_id),
  )
  const nameById = new Map(people.map((p) => [p.id, p.name]))
  const nameOf = (id: string) => nameById.get(id) ?? "(pessoa desconhecida)"

  const violations: Violation[] = []

  for (const c of conflicts) {
    if (c.status !== "ativo") continue

    const bothOnList = onList.has(c.subject_id) && onList.has(c.object_id)
    if (!bothOnList) continue

    const subject = nameOf(c.subject_id)
    const object = nameOf(c.object_id)
    const base = {
      conflictId: c.id,
      subjectId: c.subject_id,
      objectId: c.object_id,
      vetoOwner: c.veto_owner,
    }

    if (c.invite_policy === "excluir_um") {
      const excludedId = c.excluded_person_id
      const excluded = excludedId ? nameOf(excludedId) : "(não definido)"
      violations.push({
        ...base,
        level: "block",
        excludedId: excludedId ?? null,
        message: `${excluded} não deve ser convidado quando ${
          excludedId === c.subject_id ? object : subject
        } está na lista.`,
      })
      continue
    }

    if (c.invite_policy === "nao_juntos") {
      violations.push({
        ...base,
        level: "block",
        excludedId: null,
        message: `${subject} e ${object} não podem estar na mesma lista — escolha um.`,
      })
      continue
    }

    // ok_com_ressalva: sem handling, não há nada a fazer — não é violação,
    // é um conflito registrado que não exige ação.
    if (c.handling.includes("avisar_antes")) {
      violations.push({
        ...base,
        level: "warn",
        excludedId: null,
        message: `Avisar antes: ${subject} e ${object} estarão no mesmo evento.`,
      })
    }
    if (c.handling.includes("separar_no_evento")) {
      violations.push({
        ...base,
        level: "info",
        excludedId: null,
        message: `Manter ${subject} e ${object} afastados durante o evento.`,
      })
    }
  }

  return violations.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level])
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `npm test -- src/lib/people/conflicts.test.ts`
Expected: PASS — 13 testes.

- [ ] **Step 5: Rodar a suíte inteira (não regredir nada)**

Run: `npm test`
Expected: PASS — todos os testes node, sem falhas novas.

- [ ] **Step 6: Verificar acentuação**

Run: `grep -c 'u00' src/lib/people/conflicts.ts src/lib/people/conflicts.test.ts`
Expected: `0` para os dois.

- [ ] **Step 7: Commit**

```bash
git add src/lib/people/conflicts.ts src/lib/people/conflicts.test.ts
git commit -m "feat(people): verificador de conflitos (função pura, 13 testes)

Único intérprete de invite_policy no app. reason nunca entra na
Violation — coberto por teste.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Queries TanStack e realtime

**Files:**
- Create: `src/lib/queries/people.ts`
- Modify: `src/lib/realtime.ts` (`TABLE_QUERY_PREFIX`)

**Interfaces:**
- Consumes: tipos da Task 2, `createClient` de `@/lib/supabase/client`, `useRealtimeTable` de `@/lib/realtime`
- Produces: `peopleKeys`, `peopleOptions`, `usePeople`, `useCreatePerson`, `useUpdatePerson`, `useDeletePerson`, `useRelations`, `useCreateRelation`, `useDeleteRelation`, `useConflicts`, `useCreateConflict`, `useUpdateConflict`, `useDeleteConflict`, `useGuestEvents`, `useCreateGuestEvent`, `guestInvitesOptions`, `useGuestInvites`, `useUpsertInvite`

- [ ] **Step 1: Registrar as tabelas no realtime**

Em `src/lib/realtime.ts`, dentro do objeto `TABLE_QUERY_PREFIX`, adicionar após a linha `inbox_item: ["inbox"],`:

```ts
  person: ["people"],
  person_relation: ["people"],
  person_conflict: ["people"],
  guest_event: ["people"],
  guest_invite: ["people"],
```

Prefixo único: toda a UI do módulo é uma superfície só, e o debounce de 300ms já colapsa rajadas.

- [ ] **Step 2: Escrever o módulo de queries**

Criar `src/lib/queries/people.ts`:

```ts
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query"
import { createClient } from "@/lib/supabase/client"
import { useRealtimeTable } from "@/lib/realtime"
import type {
  PersonRow,
  PersonRelationRow,
  PersonConflictRow,
  GuestEventRow,
  GuestInviteRow,
  InviteStatus,
} from "@/lib/types"
import type { Person, PersonConflict, PersonRelation, GuestEvent } from "@/lib/schemas/people"

// PGRST_DB_MAX_ROWS=1000 no PostgREST do VPS trunca SILENCIOSAMENTE toda
// query sem .range(). Foi esse bug que deixou /notes vazia em todos os
// devices. Volume baixo hoje não é desculpa.
const PAGE = 1000

async function fetchAllPages<T>(
  build: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as T[]
    all.push(...rows)
    if (rows.length < PAGE) break
  }
  return all
}

async function currentUserId(): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Not authenticated")
  return user.id
}

export const peopleKeys = {
  all: ["people"] as const,
  persons: ["people", "person"] as const,
  relations: ["people", "relation"] as const,
  conflicts: ["people", "conflict"] as const,
  events: ["people", "event"] as const,
  invites: (eventId: string) => ["people", "invite", eventId] as const,
}

// ------------------------------------------------------------------ person

export const peopleOptions = queryOptions({
  queryKey: peopleKeys.persons,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<PersonRow[]> => {
    const supabase = createClient()
    const ownerId = await currentUserId()
    return fetchAllPages<PersonRow>((from, to) =>
      supabase
        .from("person")
        .select("*")
        .eq("owner_id", ownerId)
        .order("name", { ascending: true })
        .range(from, to),
    )
  },
})

export function usePeople() {
  useRealtimeTable("person")
  return useQuery(peopleOptions)
}

export function useCreatePerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (person: Person): Promise<PersonRow> => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      const { id: _ignored, ...fields } = person
      const { data, error } = await supabase
        .from("person")
        .insert({ ...fields, owner_id: ownerId })
        .select("*")
        .single()
      if (error) throw error
      return data as PersonRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

export function useUpdatePerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...fields }: Person & { id: string }): Promise<PersonRow> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("person")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single()
      if (error) throw error
      return data as PersonRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

export function useDeletePerson() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("person").delete().eq("id", id)
      if (error) throw error
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

// ---------------------------------------------------------- person_relation

export const relationsOptions = queryOptions({
  queryKey: peopleKeys.relations,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<PersonRelationRow[]> => {
    const supabase = createClient()
    const ownerId = await currentUserId()
    return fetchAllPages<PersonRelationRow>((from, to) =>
      supabase
        .from("person_relation")
        .select("*")
        .eq("owner_id", ownerId)
        .range(from, to),
    )
  },
})

export function useRelations() {
  useRealtimeTable("person_relation")
  return useQuery(relationsOptions)
}

export function useCreateRelation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (relation: PersonRelation): Promise<PersonRelationRow> => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      const { id: _ignored, ...fields } = relation
      const { data, error } = await supabase
        .from("person_relation")
        .insert({ ...fields, owner_id: ownerId })
        .select("*")
        .single()
      if (error) throw error
      return data as PersonRelationRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

export function useDeleteRelation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("person_relation").delete().eq("id", id)
      if (error) throw error
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

// ---------------------------------------------------------- person_conflict

export const conflictsOptions = queryOptions({
  queryKey: peopleKeys.conflicts,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<PersonConflictRow[]> => {
    const supabase = createClient()
    const ownerId = await currentUserId()
    return fetchAllPages<PersonConflictRow>((from, to) =>
      supabase
        .from("person_conflict")
        .select("*")
        .eq("owner_id", ownerId)
        .range(from, to),
    )
  },
})

export function useConflicts() {
  useRealtimeTable("person_conflict")
  return useQuery(conflictsOptions)
}

export function useCreateConflict() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (conflict: PersonConflict): Promise<PersonConflictRow> => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      const { id: _ignored, ...fields } = conflict
      const { data, error } = await supabase
        .from("person_conflict")
        .insert({ ...fields, owner_id: ownerId })
        .select("*")
        .single()
      if (error) throw error
      return data as PersonConflictRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

export function useUpdateConflict() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      ...fields
    }: PersonConflict & { id: string }): Promise<PersonConflictRow> => {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("person_conflict")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .single()
      if (error) throw error
      return data as PersonConflictRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

export function useDeleteConflict() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient()
      const { error } = await supabase.from("person_conflict").delete().eq("id", id)
      if (error) throw error
      return id
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

// -------------------------------------------------------------- guest_event

export const guestEventsOptions = queryOptions({
  queryKey: peopleKeys.events,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<GuestEventRow[]> => {
    const supabase = createClient()
    const ownerId = await currentUserId()
    const { data, error } = await supabase
      .from("guest_event")
      .select("*")
      .eq("owner_id", ownerId)
      .order("event_date", { ascending: false, nullsFirst: false })
      .range(0, PAGE - 1)
    if (error) throw error
    return (data ?? []) as GuestEventRow[]
  },
})

export function useGuestEvents() {
  useRealtimeTable("guest_event")
  return useQuery(guestEventsOptions)
}

export function useCreateGuestEvent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (event: GuestEvent): Promise<GuestEventRow> => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      const { id: _ignored, ...fields } = event
      const { data, error } = await supabase
        .from("guest_event")
        .insert({ ...fields, owner_id: ownerId })
        .select("*")
        .single()
      if (error) throw error
      return data as GuestEventRow
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: peopleKeys.all }),
  })
}

// ------------------------------------------------------------- guest_invite

export function guestInvitesOptions(eventId: string) {
  return queryOptions({
    queryKey: peopleKeys.invites(eventId),
    enabled: !!eventId,
    staleTime: 30_000,
    queryFn: async (): Promise<GuestInviteRow[]> => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      return fetchAllPages<GuestInviteRow>((from, to) =>
        supabase
          .from("guest_invite")
          .select("*")
          .eq("owner_id", ownerId)
          .eq("event_id", eventId)
          .range(from, to),
      )
    },
  })
}

export function useGuestInvites(eventId: string) {
  useRealtimeTable("guest_invite")
  return useQuery(guestInvitesOptions(eventId))
}

/**
 * Um clique na tela muda o status de UMA pessoa naquele evento. Upsert com
 * onConflict na unique (event_id, person_id): a primeira marcação cria a
 * linha, as seguintes atualizam. Evita o par lookup+insert/update que já
 * causou linhas duplicadas em budget e meal_plan neste projeto.
 */
export function useUpsertInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      eventId: string
      personId: string
      status: InviteStatus
    }): Promise<GuestInviteRow> => {
      const supabase = createClient()
      const ownerId = await currentUserId()
      const { data, error } = await supabase
        .from("guest_invite")
        .upsert(
          {
            owner_id: ownerId,
            event_id: input.eventId,
            person_id: input.personId,
            status: input.status,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "event_id,person_id" },
        )
        .select("*")
        .single()
      if (error) throw error
      return data as GuestInviteRow
    },
    onSuccess: (_data, vars) =>
      queryClient.invalidateQueries({ queryKey: peopleKeys.invites(vars.eventId) }),
  })
}
```

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit 2>&1 | grep -c 'queries/people\|lib/people\|schemas/people\|types/people'`
Expected: `0`.

`tsc --noEmit` **nunca** passa limpo neste projeto — o que importa é que **os arquivos novos** não aparecem na lista de erros. Não tente zerar a saída global.

- [ ] **Step 4: Rodar a suíte**

Run: `npm test`
Expected: PASS, sem regressões.

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries/people.ts src/lib/realtime.ts
git commit -m "feat(people): queries TanStack paginadas + realtime

Toda query pagina em blocos de 1000 desde o início — PGRST_DB_MAX_ROWS
trunca em silêncio. useUpsertInvite usa onConflict na unique para não
repetir o bug de lookup+insert que duplicou linhas em budget/meal_plan.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Export/Import — preservar o grafo no restore

`importAllData` hoje stripa `id` e zera FKs. Aplicado a este módulo, um restore devolveria **pessoas soltas, zero relações e zero conflitos** — perda silenciosa exatamente do dado que não se reconstrói de memória (spec §7.1). Esta tarefa extrai a lógica de limpeza para uma função pura, testa, e só então muda o comportamento.

**Files:**
- Create: `src/lib/import-clean.ts`
- Create: `tests/import-clean.test.ts`
- Modify: `src/lib/export-import.ts`

**Interfaces:**
- Consumes: nada das tarefas anteriores (só os nomes de tabela da Task 1)
- Produces: `PRESERVE_ID_TABLES: ReadonlySet<string>`, `cleanRowsForImport(table, rows, ownerId, fksToStrip): Record<string, unknown>[]`

- [ ] **Step 1: Escrever o teste do helper (falha primeiro)**

Criar `tests/import-clean.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { cleanRowsForImport, PRESERVE_ID_TABLES } from "@/lib/import-clean"

const OWNER = "owner-novo"

describe("cleanRowsForImport", () => {
  it("stripa id e timestamps nas tabelas normais", () => {
    const out = cleanRowsForImport(
      "task",
      [{ id: "t1", owner_id: "antigo", created_at: "x", updated_at: "y", title: "Oi" }],
      OWNER,
      [],
    )
    expect(out[0]).not.toHaveProperty("id")
    expect(out[0]).not.toHaveProperty("created_at")
    expect(out[0].owner_id).toBe(OWNER)
    expect(out[0].title).toBe("Oi")
  })

  it("zera as FKs listadas nas tabelas normais", () => {
    const out = cleanRowsForImport(
      "task",
      [{ id: "t1", project_id: "p1", title: "Oi" }],
      OWNER,
      ["project_id"],
    )
    expect(out[0].project_id).toBeNull()
  })

  it("PRESERVA o id nas tabelas do módulo people", () => {
    const out = cleanRowsForImport(
      "person",
      [{ id: "p1", owner_id: "antigo", created_at: "x", name: "Ana" }],
      OWNER,
      [],
    )
    expect(out[0].id).toBe("p1")
    expect(out[0].owner_id).toBe(OWNER)
    expect(out[0]).not.toHaveProperty("created_at")
  })

  it("PRESERVA as FKs intra-módulo do conflito", () => {
    // Este é o teste que impede a regressão: se subject_id/object_id forem
    // zerados, um restore devolve conflitos órfãos e o grafo morre.
    const out = cleanRowsForImport(
      "person_conflict",
      [
        {
          id: "c1",
          subject_id: "p1",
          object_id: "p2",
          excluded_person_id: "p1",
          invite_policy: "excluir_um",
        },
      ],
      OWNER,
      [],
    )
    expect(out[0].subject_id).toBe("p1")
    expect(out[0].object_id).toBe("p2")
    expect(out[0].excluded_person_id).toBe("p1")
  })

  it("as cinco tabelas do módulo estão em PRESERVE_ID_TABLES", () => {
    for (const t of [
      "person",
      "person_relation",
      "person_conflict",
      "guest_event",
      "guest_invite",
    ]) {
      expect(PRESERVE_ID_TABLES.has(t)).toBe(true)
    }
  })

  it("tabelas antigas NÃO estão em PRESERVE_ID_TABLES", () => {
    expect(PRESERVE_ID_TABLES.has("task")).toBe(false)
    expect(PRESERVE_ID_TABLES.has("note")).toBe(false)
  })

  it("linha sem id em tabela preservada não inventa id", () => {
    const out = cleanRowsForImport("person", [{ name: "Ana" }], OWNER, [])
    expect(out[0]).not.toHaveProperty("id")
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- tests/import-clean.test.ts`
Expected: FAIL — `Cannot find module '@/lib/import-clean'`.

- [ ] **Step 3: Escrever o helper puro**

Criar `src/lib/import-clean.ts`:

```ts
/**
 * Tabelas cujo `id` é preservado no import, em vez de stripado.
 *
 * Motivo: as FKs do módulo people são INTRA-módulo (person_relation e
 * person_conflict apontam para person; guest_invite aponta para os dois).
 * O tratamento padrão — stripar id e zerar FK — devolveria pessoas soltas,
 * zero relações e zero conflitos num restore, perdendo em silêncio o único
 * dado do app que não se reconstrói de memória.
 *
 * É seguro porque o app é single-user: o caso de uso real do import é
 * restaurar o próprio backup, não migrar dados entre usuários.
 */
export const PRESERVE_ID_TABLES: ReadonlySet<string> = new Set([
  "person",
  "person_relation",
  "person_conflict",
  "guest_event",
  "guest_invite",
])

export function cleanRowsForImport(
  table: string,
  rows: Record<string, unknown>[],
  ownerId: string,
  fksToStrip: string[],
): Record<string, unknown>[] {
  const preserveId = PRESERVE_ID_TABLES.has(table)

  return rows.map((row) => {
    const { id, created_at: _c, updated_at: _u, ...rest } = row
    for (const fk of fksToStrip) {
      if (fk in rest) rest[fk] = null
    }
    const base = { ...rest, owner_id: ownerId }
    return preserveId && id !== undefined ? { ...base, id } : base
  })
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `npm test -- tests/import-clean.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 5: Ligar o helper no `export-import.ts`**

Em `src/lib/export-import.ts`:

**5a.** Adicionar o import no topo:

```ts
import { cleanRowsForImport, PRESERVE_ID_TABLES } from "@/lib/import-clean"
```

**5b.** Substituir a constante `TABLES` (linha 4) por:

```ts
const TABLES = ["task", "project", "account", "transaction", "health_log", "pregnancy", "appointment", "protocol", "protocol_entry", "note", "meal", "meal_plan", "habit_track", "habit_entry", "budget", "annual_event", "inbox_item", "person", "person_relation", "person_conflict", "guest_event", "guest_invite"] as const
```

**5c.** No array `IMPORT_ORDER`, adicionar as cinco tabelas ao final, **nesta ordem** (parent-first: `person` e `guest_event` antes de quem os referencia):

```ts
  "inbox_item",
  "person",
  "guest_event",
  "person_relation",
  "person_conflict",
  "guest_invite",
] as const
```

**5d.** Substituir o bloco `const cleaned = rows.map(...)` inteiro (as linhas do `map` com o destructuring e o loop de FK) por:

```ts
    const cleaned = cleanRowsForImport(table, rows as Record<string, unknown>[], user.id, fksToStrip)
```

**5e.** Substituir a linha do insert dentro do loop de chunks por:

```ts
      const { error } = PRESERVE_ID_TABLES.has(table)
        ? await supabase.from(table).upsert(chunk, { onConflict: "id" })
        : await supabase.from(table).insert(chunk)
```

**5f.** Subir a versão do export:

```ts
    version: "0.4.0",
```

**Nota deliberada:** `FK_COLUMNS_TO_STRIP` **não** ganha entradas para as tabelas novas. As FKs intra-módulo têm que sobreviver — é o ponto inteiro desta tarefa.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test`
Expected: PASS, sem regressões.

- [ ] **Step 7: Verificar que compila**

Run: `npx tsc --noEmit 2>&1 | grep -c 'export-import\|import-clean'`
Expected: `0`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/import-clean.ts tests/import-clean.test.ts src/lib/export-import.ts
git commit -m "feat(people): export/import preserva o grafo no restore

As 5 tabelas novas entram em PRESERVE_ID_TABLES: id mantido, FKs
intra-módulo não zeradas, insert vira upsert onConflict:id (restore
idempotente). Sem isso um restore devolvia pessoas soltas e zero
conflitos. Lógica extraída para helper puro com 7 testes.

Export version 0.3.0 -> 0.4.0.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Página `/people` — lista e CRUD de pessoa

**Files:**
- Create: `src/components/people/PersonRow.tsx`
- Create: `src/components/people/PersonFormDialog.tsx`
- Create: `src/app/(app)/people/page.tsx`

**Interfaces:**
- Consumes: `usePeople`, `useCreatePerson`, `useUpdatePerson`, `useDeletePerson` (Task 4); `personSchema` (Task 2)
- Produces:
  - `<PersonRow person onEdit onDelete />` com `onEdit: (id: string) => void`, `onDelete: (id: string) => void`
  - `<PersonFormDialog open onOpenChange person onSubmit />` com `person: PersonRow | null` (null = criar)

- [ ] **Step 1: Criar o `PersonRow`**

Criar `src/components/people/PersonRow.tsx`. Callbacks recebem `id` como argumento — closures no parent quebram o `memo` (bug real já documentado no `TaskRow` deste projeto):

```tsx
"use client"

import { memo } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import type { PersonRow as PersonRowType } from "@/lib/types"

const SIDE_LABEL: Record<string, string> = {
  leo: "MEU",
  parceira: "DELA",
  comum: "COMUM",
  outro: "—",
}

const CIRCLE_LABEL: Record<string, string> = {
  familia_nuclear: "Família nuclear",
  familia_extensa: "Família extensa",
  amigos: "Amigos",
  trabalho: "Trabalho",
  vizinhos: "Vizinhos",
  outro: "Outro",
}

interface Props {
  person: PersonRowType
  conflictCount: number
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export const PersonRow = memo(function PersonRow({
  person,
  conflictCount,
  onEdit,
  onDelete,
}: Props) {
  return (
    <div className="flex items-center gap-3 border-b border-on-surface/10 px-3 py-2">
      <div className="min-w-0 flex-1">
        <Link
          href={`/people/${person.id}`}
          className="block truncate text-sm text-on-surface hover:text-accent"
        >
          {person.name}
          {person.nickname ? (
            <span className="text-on-surface/40"> ({person.nickname})</span>
          ) : null}
        </Link>
        <div className="truncate text-[11px] text-on-surface/40">
          {CIRCLE_LABEL[person.circle] ?? person.circle}
          {person.household ? ` · ${person.household}` : ""}
        </div>
      </div>

      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]",
          person.side === "parceira" && "bg-accent/15 text-accent",
          person.side !== "parceira" && "bg-on-surface/10 text-on-surface/60",
        )}
      >
        {SIDE_LABEL[person.side] ?? person.side}
      </span>

      {conflictCount > 0 ? (
        <span
          className="shrink-0 rounded bg-danger/15 px-1.5 py-0.5 font-mono text-[10px] text-danger"
          title={`${conflictCount} conflito(s) ativo(s)`}
        >
          ⚠ {conflictCount}
        </span>
      ) : null}

      <button
        type="button"
        onClick={() => onEdit(person.id)}
        className="shrink-0 px-2 py-1 font-mono text-[10px] text-on-surface/60 hover:text-on-surface"
      >
        EDIT
      </button>
      <button
        type="button"
        onClick={() => onDelete(person.id)}
        className="shrink-0 px-2 py-1 font-mono text-[10px] text-on-surface/40 hover:text-danger"
      >
        DEL
      </button>
    </div>
  )
})
```

- [ ] **Step 2: Criar o `PersonFormDialog`**

Criar `src/components/people/PersonFormDialog.tsx`. Usa `useReducer` (12+ campos — padrão do `EditTaskDialog`) e deps primitivas no `useEffect`:

```tsx
"use client"

import { useEffect, useReducer } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { personSchema } from "@/lib/schemas/people"
import type { Person } from "@/lib/schemas/people"
import type { PersonRow } from "@/lib/types"

type FormState = {
  name: string
  nickname: string
  side: Person["side"]
  circle: Person["circle"]
  household: string
  phone: string
  email: string
  birthday: string
  notes: string
  error: string | null
}

const EMPTY: FormState = {
  name: "",
  nickname: "",
  side: "outro",
  circle: "outro",
  household: "",
  phone: "",
  email: "",
  birthday: "",
  notes: "",
  error: null,
}

type Action =
  | { type: "set"; field: keyof Omit<FormState, "error">; value: string }
  | { type: "error"; message: string | null }
  | { type: "reset"; state: FormState }

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value, error: null }
    case "error":
      return { ...state, error: action.message }
    case "reset":
      return action.state
  }
}

function fromRow(person: PersonRow | null): FormState {
  if (!person) return EMPTY
  return {
    name: person.name,
    nickname: person.nickname ?? "",
    side: person.side,
    circle: person.circle,
    household: person.household ?? "",
    phone: person.phone ?? "",
    email: person.email ?? "",
    birthday: person.birthday ?? "",
    notes: person.notes ?? "",
    error: null,
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  person: PersonRow | null
  onSubmit: (values: Person, id?: string) => void
}

export function PersonFormDialog({ open, onOpenChange, person, onSubmit }: Props) {
  const [state, dispatch] = useReducer(reducer, EMPTY)

  // Deps primitivas: o objeto `person` muda de identidade a cada refetch do
  // TanStack Query e resetaria o formulário no meio da digitação.
  useEffect(() => {
    if (open) dispatch({ type: "reset", state: fromRow(person) })
  }, [open, person?.id])

  function handleSubmit() {
    const parsed = personSchema.safeParse({
      name: state.name,
      nickname: state.nickname || null,
      side: state.side,
      circle: state.circle,
      household: state.household || null,
      phone: state.phone || null,
      email: state.email || null,
      birthday: state.birthday || null,
      notes: state.notes || null,
      tags: [],
    })
    if (!parsed.success) {
      dispatch({ type: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos" })
      return
    }
    onSubmit(parsed.data, person?.id)
    onOpenChange(false)
  }

  const field = "w-full border border-on-surface/20 bg-surface px-2 py-1.5 text-sm text-on-surface"
  const label = "mb-1 block font-mono text-[10px] text-on-surface/60"

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(30rem,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-on-surface/20 bg-bg p-4">
          <Dialog.Title className="mb-3 font-mono text-xs tracking-wider text-on-surface">
            {person ? "EDITAR PESSOA" : "NOVA PESSOA"}
          </Dialog.Title>

          <div className="space-y-3">
            <div>
              <label className={label} htmlFor="pf-name">NOME</label>
              <input
                id="pf-name"
                className={field}
                value={state.name}
                onChange={(e) => dispatch({ type: "set", field: "name", value: e.target.value })}
              />
            </div>

            <div>
              <label className={label} htmlFor="pf-nick">APELIDO</label>
              <input
                id="pf-nick"
                className={field}
                value={state.nickname}
                onChange={(e) => dispatch({ type: "set", field: "nickname", value: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="pf-side">LADO</label>
                <select
                  id="pf-side"
                  className={field}
                  value={state.side}
                  onChange={(e) => dispatch({ type: "set", field: "side", value: e.target.value })}
                >
                  <option value="leo">Meu</option>
                  <option value="parceira">Dela</option>
                  <option value="comum">Comum</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <div>
                <label className={label} htmlFor="pf-circle">CÍRCULO</label>
                <select
                  id="pf-circle"
                  className={field}
                  value={state.circle}
                  onChange={(e) => dispatch({ type: "set", field: "circle", value: e.target.value })}
                >
                  <option value="familia_nuclear">Família nuclear</option>
                  <option value="familia_extensa">Família extensa</option>
                  <option value="amigos">Amigos</option>
                  <option value="trabalho">Trabalho</option>
                  <option value="vizinhos">Vizinhos</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
            </div>

            <div>
              <label className={label} htmlFor="pf-house">GRUPO FAMILIAR</label>
              <input
                id="pf-house"
                className={field}
                placeholder="Ex: Casa da tia Rosa"
                value={state.household}
                onChange={(e) => dispatch({ type: "set", field: "household", value: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="pf-phone">TELEFONE</label>
                <input
                  id="pf-phone"
                  className={field}
                  value={state.phone}
                  onChange={(e) => dispatch({ type: "set", field: "phone", value: e.target.value })}
                />
              </div>
              <div>
                <label className={label} htmlFor="pf-bday">ANIVERSÁRIO</label>
                <input
                  id="pf-bday"
                  type="date"
                  className={field}
                  value={state.birthday}
                  onChange={(e) => dispatch({ type: "set", field: "birthday", value: e.target.value })}
                />
              </div>
            </div>

            <div>
              <label className={label} htmlFor="pf-notes">NOTAS</label>
              <textarea
                id="pf-notes"
                rows={3}
                className={field}
                value={state.notes}
                onChange={(e) => dispatch({ type: "set", field: "notes", value: e.target.value })}
              />
            </div>

            {state.error ? (
              <p className="font-mono text-[11px] text-danger">{state.error}</p>
            ) : null}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close className="px-3 py-1.5 font-mono text-[11px] text-on-surface/60 hover:text-on-surface">
              CANCELAR
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSubmit}
              className="bg-accent px-3 py-1.5 font-mono text-[11px] text-bg"
            >
              SALVAR
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 3: Criar a página `/people`**

Criar `src/app/(app)/people/page.tsx`:

```tsx
"use client"

import { useState, useCallback, useMemo } from "react"
import dynamic from "next/dynamic"
import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { useUndoToast } from "@/components/UndoToast"
import {
  usePeople,
  useConflicts,
  useCreatePerson,
  useUpdatePerson,
  useDeletePerson,
} from "@/lib/queries/people"
import { PersonRow } from "@/components/people/PersonRow"
import type { PersonRow as PersonRowType } from "@/lib/types"
import type { Person } from "@/lib/schemas/people"

const PersonFormDialog = dynamic(
  () => import("@/components/people/PersonFormDialog").then((m) => ({ default: m.PersonFormDialog })),
  { ssr: false },
)

export default function PeoplePage() {
  useTitle("Pessoas · Suganuma Ops Hub")
  const { data: people = [], isLoading } = usePeople()
  const { data: conflicts = [] } = useConflicts()
  const createPerson = useCreatePerson()
  const updatePerson = useUpdatePerson()
  const deletePerson = useDeletePerson()
  const toast = useUndoToast()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<PersonRowType | null>(null)
  const [search, setSearch] = useState("")
  const [sideFilter, setSideFilter] = useState<string>("all")

  const conflictCountByPerson = useMemo(() => {
    const counts = new Map<string, number>()
    for (const c of conflicts) {
      if (c.status !== "ativo") continue
      counts.set(c.subject_id, (counts.get(c.subject_id) ?? 0) + 1)
      counts.set(c.object_id, (counts.get(c.object_id) ?? 0) + 1)
    }
    return counts
  }, [conflicts])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return people.filter((p) => {
      if (sideFilter !== "all" && p.side !== sideFilter) return false
      if (!term) return true
      return (
        p.name.toLowerCase().includes(term) ||
        (p.nickname ?? "").toLowerCase().includes(term) ||
        (p.household ?? "").toLowerCase().includes(term)
      )
    })
  }, [people, search, sideFilter])

  const handleEdit = useCallback(
    (id: string) => {
      setEditing(people.find((p) => p.id === id) ?? null)
      setFormOpen(true)
    },
    [people],
  )

  const handleDelete = useCallback(
    (id: string) => {
      const person = people.find((p) => p.id === id)
      if (!person) return
      deletePerson.mutate(id)
      toast.show(`${person.name} removido`, () => {
        createPerson.mutate({
          name: person.name,
          nickname: person.nickname,
          side: person.side,
          circle: person.circle,
          household: person.household,
          phone: person.phone,
          email: person.email,
          birthday: person.birthday,
          notes: person.notes,
          tags: person.tags,
        })
      })
    },
    [people, deletePerson, createPerson, toast],
  )

  const handleSubmit = useCallback(
    (values: Person, id?: string) => {
      if (id) updatePerson.mutate({ ...values, id })
      else createPerson.mutate(values)
    },
    [createPerson, updatePerson],
  )

  return (
    <SectionErrorBoundary>
      <div className="p-3">
        <div className="mb-3 flex items-center gap-2">
          <input
            className="min-w-0 flex-1 border border-on-surface/20 bg-surface px-2 py-1.5 text-sm text-on-surface"
            placeholder="Buscar pessoa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="border border-on-surface/20 bg-surface px-2 py-1.5 font-mono text-[11px] text-on-surface"
            value={sideFilter}
            onChange={(e) => setSideFilter(e.target.value)}
          >
            <option value="all">TODOS</option>
            <option value="leo">MEU</option>
            <option value="parceira">DELA</option>
            <option value="comum">COMUM</option>
            <option value="outro">OUTRO</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setEditing(null)
              setFormOpen(true)
            }}
            className="shrink-0 bg-accent px-3 py-1.5 font-mono text-[11px] text-bg"
          >
            + PESSOA
          </button>
        </div>

        {isLoading ? <div className="h-32 animate-pulse bg-on-surface/5" /> : null}

        {!isLoading && visible.length === 0 ? (
          <p className="py-8 text-center font-mono text-[11px] text-on-surface/40">
            Nenhuma pessoa encontrada.
          </p>
        ) : null}

        {!isLoading
          ? visible.map((p) => (
              <PersonRow
                key={p.id}
                person={p}
                conflictCount={conflictCountByPerson.get(p.id) ?? 0}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
            ))
          : null}

        {formOpen ? (
          <PersonFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            person={editing}
            onSubmit={handleSubmit}
          />
        ) : null}
      </div>
    </SectionErrorBoundary>
  )
}
```

- [ ] **Step 4: Conferir a assinatura real do `useUndoToast`**

Run: `grep -n 'show' src/components/UndoToast.tsx | head -10`

Se a assinatura não for `show(message, onUndo)`, ajustar a chamada em `handleDelete` para a assinatura real antes de seguir. **Não** adivinhe.

- [ ] **Step 5: Verificar que compila**

Run: `npx tsc --noEmit 2>&1 | grep 'people/' | head -20`
Expected: nenhuma linha.

- [ ] **Step 6: Rodar o build**

Run: `npm run build`
Expected: build verde, com `/people` na lista de rotas.

- [ ] **Step 7: Verificar acentuação**

Run: `grep -c 'u00' src/components/people/*.tsx 'src/app/(app)/people/page.tsx'`
Expected: `0` em todos.

- [ ] **Step 8: Commit**

```bash
git add src/components/people 'src/app/(app)/people/page.tsx'
git commit -m "feat(people): página /people com lista, filtros e CRUD de pessoa

PersonRow memoizado com callbacks por arg (closure no parent quebra o
memo). PersonFormDialog com useReducer e deps primitivas no useEffect.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Ficha `/people/[id]` — relações e conflitos

**Files:**
- Create: `src/components/people/ConflictFormDialog.tsx`
- Create: `src/components/people/RelationFormDialog.tsx`
- Create: `src/app/(app)/people/[id]/page.tsx`

**Interfaces:**
- Consumes: `usePeople`, `useRelations`, `useConflicts`, `useCreateRelation`, `useDeleteRelation`, `useCreateConflict`, `useUpdateConflict`, `useDeleteConflict` (Task 4); `personConflictSchema`, `personRelationSchema` (Task 2)
- Produces:
  - `<ConflictFormDialog open onOpenChange people anchorPersonId conflict onSubmit />`
  - `<RelationFormDialog open onOpenChange people anchorPersonId onSubmit />`

- [ ] **Step 1: Criar o `ConflictFormDialog`**

Criar `src/components/people/ConflictFormDialog.tsx`. O seletor de `excluded_person_id` só aparece com `invite_policy = "excluir_um"`, e oferece **apenas** as duas pontas do conflito — é a UI espelhando a constraint `person_conflict_excluded_is_an_endpoint`:

```tsx
"use client"

import { useEffect, useReducer } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { personConflictSchema } from "@/lib/schemas/people"
import type { PersonConflict } from "@/lib/schemas/people"
import type { PersonRow, PersonConflictRow, ConflictHandling } from "@/lib/types"

type FormState = {
  subject_id: string
  object_id: string
  invite_policy: PersonConflict["invite_policy"]
  excluded_person_id: string
  handling: ConflictHandling[]
  veto_owner: PersonConflict["veto_owner"]
  reason: string
  status: PersonConflict["status"]
  error: string | null
}

type Action =
  | { type: "set"; field: keyof Omit<FormState, "error" | "handling">; value: string }
  | { type: "toggleHandling"; value: ConflictHandling }
  | { type: "error"; message: string | null }
  | { type: "reset"; state: FormState }

function reducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "set": {
      const next = { ...state, [action.field]: action.value, error: null }
      // Trocar de política para fora de excluir_um limpa o excluído, senão
      // sobra um id órfão que o refine do Zod rejeita sem motivo visível.
      if (action.field === "invite_policy" && action.value !== "excluir_um") {
        next.excluded_person_id = ""
      }
      return next
    }
    case "toggleHandling":
      return {
        ...state,
        error: null,
        handling: state.handling.includes(action.value)
          ? state.handling.filter((h) => h !== action.value)
          : [...state.handling, action.value],
      }
    case "error":
      return { ...state, error: action.message }
    case "reset":
      return action.state
  }
}

function initial(anchorPersonId: string, conflict: PersonConflictRow | null): FormState {
  if (conflict) {
    return {
      subject_id: conflict.subject_id,
      object_id: conflict.object_id,
      invite_policy: conflict.invite_policy,
      excluded_person_id: conflict.excluded_person_id ?? "",
      handling: conflict.handling,
      veto_owner: conflict.veto_owner,
      reason: conflict.reason ?? "",
      status: conflict.status,
      error: null,
    }
  }
  return {
    subject_id: anchorPersonId,
    object_id: "",
    invite_policy: "nao_juntos",
    excluded_person_id: "",
    handling: [],
    veto_owner: "eu",
    reason: "",
    status: "ativo",
    error: null,
  }
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: PersonRow[]
  anchorPersonId: string
  conflict: PersonConflictRow | null
  onSubmit: (values: PersonConflict, id?: string) => void
}

export function ConflictFormDialog({
  open,
  onOpenChange,
  people,
  anchorPersonId,
  conflict,
  onSubmit,
}: Props) {
  const [state, dispatch] = useReducer(reducer, initial(anchorPersonId, conflict))

  useEffect(() => {
    if (open) dispatch({ type: "reset", state: initial(anchorPersonId, conflict) })
  }, [open, anchorPersonId, conflict?.id])

  const nameOf = (id: string) => people.find((p) => p.id === id)?.name ?? ""

  function handleSubmit() {
    const parsed = personConflictSchema.safeParse({
      subject_id: state.subject_id,
      object_id: state.object_id,
      invite_policy: state.invite_policy,
      excluded_person_id: state.excluded_person_id || null,
      handling: state.handling,
      veto_owner: state.veto_owner,
      reason: state.reason || null,
      status: state.status,
    })
    if (!parsed.success) {
      dispatch({ type: "error", message: parsed.error.issues[0]?.message ?? "Dados inválidos" })
      return
    }
    onSubmit(parsed.data, conflict?.id)
    onOpenChange(false)
  }

  const field = "w-full border border-on-surface/20 bg-surface px-2 py-1.5 text-sm text-on-surface"
  const label = "mb-1 block font-mono text-[10px] text-on-surface/60"

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-[min(32rem,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-on-surface/20 bg-bg p-4">
          <Dialog.Title className="mb-3 font-mono text-xs tracking-wider text-on-surface">
            {conflict ? "EDITAR CONFLITO" : "NOVO CONFLITO"}
          </Dialog.Title>

          <div className="space-y-3">
            <div>
              <label className={label} htmlFor="cf-subject">QUEM SE INCOMODA</label>
              <select
                id="cf-subject"
                className={field}
                value={state.subject_id}
                onChange={(e) => dispatch({ type: "set", field: "subject_id", value: e.target.value })}
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={label} htmlFor="cf-object">COM QUEM</label>
              <select
                id="cf-object"
                className={field}
                value={state.object_id}
                onChange={(e) => dispatch({ type: "set", field: "object_id", value: e.target.value })}
              >
                <option value="">Escolha...</option>
                {people
                  .filter((p) => p.id !== state.subject_id)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className={label} htmlFor="cf-policy">POLÍTICA DE CONVITE</label>
              <select
                id="cf-policy"
                className={field}
                value={state.invite_policy}
                onChange={(e) => dispatch({ type: "set", field: "invite_policy", value: e.target.value })}
              >
                <option value="excluir_um">Excluir um dos dois (decisão permanente)</option>
                <option value="nao_juntos">Não podem estar juntos (decido no evento)</option>
                <option value="ok_com_ressalva">Podem vir, com ressalva</option>
              </select>
            </div>

            {state.invite_policy === "excluir_um" ? (
              <div>
                <label className={label} htmlFor="cf-excluded">QUEM FICA DE FORA</label>
                <select
                  id="cf-excluded"
                  className={field}
                  value={state.excluded_person_id}
                  onChange={(e) =>
                    dispatch({ type: "set", field: "excluded_person_id", value: e.target.value })
                  }
                >
                  <option value="">Escolha...</option>
                  {state.subject_id ? (
                    <option value={state.subject_id}>{nameOf(state.subject_id)}</option>
                  ) : null}
                  {state.object_id ? (
                    <option value={state.object_id}>{nameOf(state.object_id)}</option>
                  ) : null}
                </select>
              </div>
            ) : null}

            {state.invite_policy === "ok_com_ressalva" ? (
              <div>
                <span className={label}>O QUE FAZER</span>
                <label className="flex items-center gap-2 py-1 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={state.handling.includes("avisar_antes")}
                    onChange={() => dispatch({ type: "toggleHandling", value: "avisar_antes" })}
                  />
                  Avisar antes
                </label>
                <label className="flex items-center gap-2 py-1 text-sm text-on-surface">
                  <input
                    type="checkbox"
                    checked={state.handling.includes("separar_no_evento")}
                    onChange={() => dispatch({ type: "toggleHandling", value: "separar_no_evento" })}
                  />
                  Manter afastados no evento
                </label>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label} htmlFor="cf-veto">DE QUEM É A DECISÃO</label>
                <select
                  id="cf-veto"
                  className={field}
                  value={state.veto_owner}
                  onChange={(e) => dispatch({ type: "set", field: "veto_owner", value: e.target.value })}
                >
                  <option value="eu">Minha</option>
                  <option value="parceira">Dela</option>
                  <option value="ambos">Nossa</option>
                </select>
              </div>
              <div>
                <label className={label} htmlFor="cf-status">SITUAÇÃO</label>
                <select
                  id="cf-status"
                  className={field}
                  value={state.status}
                  onChange={(e) => dispatch({ type: "set", field: "status", value: e.target.value })}
                >
                  <option value="ativo">Ativo</option>
                  <option value="resolvido">Resolvido</option>
                </select>
              </div>
            </div>

            <div>
              <label className={label} htmlFor="cf-reason">MOTIVO</label>
              <textarea
                id="cf-reason"
                rows={3}
                className={field}
                value={state.reason}
                onChange={(e) => dispatch({ type: "set", field: "reason", value: e.target.value })}
              />
              <p className="mt-1 font-mono text-[10px] text-on-surface/40">
                Fica só aqui: não entra em busca, embedding nem em ferramenta de IA.
              </p>
            </div>

            {state.error ? (
              <p className="font-mono text-[11px] text-danger">{state.error}</p>
            ) : null}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close className="px-3 py-1.5 font-mono text-[11px] text-on-surface/60 hover:text-on-surface">
              CANCELAR
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSubmit}
              className="bg-accent px-3 py-1.5 font-mono text-[11px] text-bg"
            >
              SALVAR
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 2: Criar o `RelationFormDialog`**

Criar `src/components/people/RelationFormDialog.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { personRelationSchema } from "@/lib/schemas/people"
import type { PersonRelation } from "@/lib/schemas/people"
import type { PersonRow, RelationKind } from "@/lib/types"

const KIND_LABEL: Record<RelationKind, string> = {
  conjuge: "é cônjuge de",
  filho_de: "é filho(a) de",
  pai_de: "é pai/mãe de",
  irmao_de: "é irmão(ã) de",
  amigo_de: "é amigo(a) de",
  colega_de: "é colega de",
  ex_de: "é ex de",
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  people: PersonRow[]
  anchorPersonId: string
  onSubmit: (values: PersonRelation) => void
}

export function RelationFormDialog({
  open,
  onOpenChange,
  people,
  anchorPersonId,
  onSubmit,
}: Props) {
  const [toPerson, setToPerson] = useState("")
  const [kind, setKind] = useState<RelationKind>("amigo_de")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setToPerson("")
      setKind("amigo_de")
      setError(null)
    }
  }, [open])

  function handleSubmit() {
    const parsed = personRelationSchema.safeParse({
      from_person: anchorPersonId,
      to_person: toPerson,
      kind,
      note: null,
    })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dados inválidos")
      return
    }
    onSubmit(parsed.data)
    onOpenChange(false)
  }

  const field = "w-full border border-on-surface/20 bg-surface px-2 py-1.5 text-sm text-on-surface"
  const label = "mb-1 block font-mono text-[10px] text-on-surface/60"

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/50" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,92vw)] -translate-x-1/2 -translate-y-1/2 border border-on-surface/20 bg-bg p-4">
          <Dialog.Title className="mb-3 font-mono text-xs tracking-wider text-on-surface">
            NOVA RELAÇÃO
          </Dialog.Title>

          <div className="space-y-3">
            <div>
              <label className={label} htmlFor="rf-kind">TIPO</label>
              <select
                id="rf-kind"
                className={field}
                value={kind}
                onChange={(e) => setKind(e.target.value as RelationKind)}
              >
                {(Object.keys(KIND_LABEL) as RelationKind[]).map((k) => (
                  <option key={k} value={k}>{KIND_LABEL[k]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={label} htmlFor="rf-to">PESSOA</label>
              <select
                id="rf-to"
                className={field}
                value={toPerson}
                onChange={(e) => setToPerson(e.target.value)}
              >
                <option value="">Escolha...</option>
                {people
                  .filter((p) => p.id !== anchorPersonId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
            </div>

            {error ? <p className="font-mono text-[11px] text-danger">{error}</p> : null}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close className="px-3 py-1.5 font-mono text-[11px] text-on-surface/60 hover:text-on-surface">
              CANCELAR
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSubmit}
              className="bg-accent px-3 py-1.5 font-mono text-[11px] text-bg"
            >
              SALVAR
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
```

- [ ] **Step 3: Criar a página da ficha**

Criar `src/app/(app)/people/[id]/page.tsx`. O `reason` do conflito fica atrás de um toggle explícito — é o campo mais sensível do módulo:

```tsx
"use client"

import { useState, useCallback, useMemo, use } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import {
  usePeople,
  useRelations,
  useConflicts,
  useCreateRelation,
  useDeleteRelation,
  useCreateConflict,
  useUpdateConflict,
  useDeleteConflict,
} from "@/lib/queries/people"
import type { PersonConflictRow } from "@/lib/types"
import type { PersonConflict, PersonRelation } from "@/lib/schemas/people"

const ConflictFormDialog = dynamic(
  () => import("@/components/people/ConflictFormDialog").then((m) => ({ default: m.ConflictFormDialog })),
  { ssr: false },
)
const RelationFormDialog = dynamic(
  () => import("@/components/people/RelationFormDialog").then((m) => ({ default: m.RelationFormDialog })),
  { ssr: false },
)

const POLICY_LABEL: Record<string, string> = {
  excluir_um: "Excluir um",
  nao_juntos: "Não juntos",
  ok_com_ressalva: "Com ressalva",
}

const VETO_LABEL: Record<string, string> = {
  eu: "decisão minha",
  parceira: "decisão dela",
  ambos: "decisão nossa",
}

export default function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: people = [] } = usePeople()
  const { data: relations = [] } = useRelations()
  const { data: conflicts = [] } = useConflicts()
  const createRelation = useCreateRelation()
  const deleteRelation = useDeleteRelation()
  const createConflict = useCreateConflict()
  const updateConflict = useUpdateConflict()
  const deleteConflict = useDeleteConflict()

  const person = useMemo(() => people.find((p) => p.id === id) ?? null, [people, id])
  useTitle(person ? `${person.name} · Pessoas` : "Pessoa · Suganuma Ops Hub")

  const [conflictOpen, setConflictOpen] = useState(false)
  const [editingConflict, setEditingConflict] = useState<PersonConflictRow | null>(null)
  const [relationOpen, setRelationOpen] = useState(false)
  const [revealedReasons, setRevealedReasons] = useState<Set<string>>(new Set())

  const nameOf = useCallback(
    (pid: string) => people.find((p) => p.id === pid)?.name ?? "(desconhecido)",
    [people],
  )

  const personRelations = useMemo(
    () => relations.filter((r) => r.from_person === id || r.to_person === id),
    [relations, id],
  )

  const personConflicts = useMemo(
    () => conflicts.filter((c) => c.subject_id === id || c.object_id === id),
    [conflicts, id],
  )

  const toggleReason = useCallback((conflictId: string) => {
    setRevealedReasons((prev) => {
      const next = new Set(prev)
      if (next.has(conflictId)) next.delete(conflictId)
      else next.add(conflictId)
      return next
    })
  }, [])

  const handleConflictSubmit = useCallback(
    (values: PersonConflict, conflictId?: string) => {
      if (conflictId) updateConflict.mutate({ ...values, id: conflictId })
      else createConflict.mutate(values)
    },
    [createConflict, updateConflict],
  )

  const handleRelationSubmit = useCallback(
    (values: PersonRelation) => createRelation.mutate(values),
    [createRelation],
  )

  if (!person) {
    return (
      <SectionErrorBoundary>
        <div className="p-4">
          <p className="font-mono text-[11px] text-on-surface/40">Pessoa não encontrada.</p>
          <Link href="/people" className="font-mono text-[11px] text-accent">← VOLTAR</Link>
        </div>
      </SectionErrorBoundary>
    )
  }

  return (
    <SectionErrorBoundary>
      <div className="p-3">
        <Link href="/people" className="font-mono text-[10px] text-on-surface/40 hover:text-accent">
          ← PESSOAS
        </Link>

        <h1 className="mt-2 text-lg text-on-surface">{person.name}</h1>
        <p className="font-mono text-[11px] text-on-surface/40">
          {person.household ?? "sem grupo familiar"}
          {person.phone ? ` · ${person.phone}` : ""}
        </p>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-mono text-[11px] tracking-wider text-on-surface/60">RELAÇÕES</h2>
            <button
              type="button"
              onClick={() => setRelationOpen(true)}
              className="font-mono text-[10px] text-accent"
            >
              + RELAÇÃO
            </button>
          </div>
          {personRelations.length === 0 ? (
            <p className="font-mono text-[11px] text-on-surface/40">Nenhuma relação.</p>
          ) : (
            personRelations.map((r) => (
              <div
                key={r.id}
                className="flex items-center gap-2 border-b border-on-surface/10 py-1.5 text-sm text-on-surface"
              >
                <span className="flex-1">
                  {r.from_person === id ? nameOf(r.to_person) : nameOf(r.from_person)}
                  <span className="ml-2 font-mono text-[10px] text-on-surface/40">{r.kind}</span>
                </span>
                <button
                  type="button"
                  onClick={() => deleteRelation.mutate(r.id)}
                  className="font-mono text-[10px] text-on-surface/40 hover:text-danger"
                >
                  DEL
                </button>
              </div>
            ))
          )}
        </section>

        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-mono text-[11px] tracking-wider text-on-surface/60">CONFLITOS</h2>
            <button
              type="button"
              onClick={() => {
                setEditingConflict(null)
                setConflictOpen(true)
              }}
              className="font-mono text-[10px] text-accent"
            >
              + CONFLITO
            </button>
          </div>

          {personConflicts.length === 0 ? (
            <p className="font-mono text-[11px] text-on-surface/40">Nenhum conflito registrado.</p>
          ) : (
            personConflicts.map((c) => (
              <div key={c.id} className="border-b border-on-surface/10 py-2">
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-sm text-on-surface">
                    {c.subject_id === id ? "com " : "de "}
                    {nameOf(c.subject_id === id ? c.object_id : c.subject_id)}
                  </span>
                  <span className="rounded bg-on-surface/10 px-1.5 py-0.5 font-mono text-[10px] text-on-surface/60">
                    {POLICY_LABEL[c.invite_policy] ?? c.invite_policy}
                  </span>
                  {c.status === "resolvido" ? (
                    <span className="font-mono text-[10px] text-on-surface/40">RESOLVIDO</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setEditingConflict(c)
                      setConflictOpen(true)
                    }}
                    className="font-mono text-[10px] text-on-surface/60 hover:text-on-surface"
                  >
                    EDIT
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteConflict.mutate(c.id)}
                    className="font-mono text-[10px] text-on-surface/40 hover:text-danger"
                  >
                    DEL
                  </button>
                </div>

                <div className="mt-1 font-mono text-[10px] text-on-surface/40">
                  {VETO_LABEL[c.veto_owner] ?? c.veto_owner}
                  {c.excluded_person_id ? ` · fica de fora: ${nameOf(c.excluded_person_id)}` : ""}
                  {c.handling.length > 0 ? ` · ${c.handling.join(", ")}` : ""}
                </div>

                {c.reason ? (
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={() => toggleReason(c.id)}
                      className="font-mono text-[10px] text-on-surface/40 hover:text-on-surface"
                    >
                      {revealedReasons.has(c.id) ? "OCULTAR MOTIVO" : "VER MOTIVO"}
                    </button>
                    {revealedReasons.has(c.id) ? (
                      <p className="mt-1 text-[13px] text-on-surface/80">{c.reason}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </section>

        {conflictOpen ? (
          <ConflictFormDialog
            open={conflictOpen}
            onOpenChange={setConflictOpen}
            people={people}
            anchorPersonId={id}
            conflict={editingConflict}
            onSubmit={handleConflictSubmit}
          />
        ) : null}

        {relationOpen ? (
          <RelationFormDialog
            open={relationOpen}
            onOpenChange={setRelationOpen}
            people={people}
            anchorPersonId={id}
            onSubmit={handleRelationSubmit}
          />
        ) : null}
      </div>
    </SectionErrorBoundary>
  )
}
```

- [ ] **Step 4: Confirmar a API de `params` no Next.js 16**

Run: `grep -rn 'params' 'src/app/(app)' --include=page.tsx | head -5`

No Next.js 16 `params` é uma `Promise` e se lê com `use(params)`. Se nenhuma página existente usar rota dinâmica, confirmar em `node_modules/next/dist/docs/`. **Não** assumir a API antiga (`params.id` direto).

- [ ] **Step 5: Verificar que compila e builda**

Run: `npx tsc --noEmit 2>&1 | grep 'people/' | head -20`
Expected: nenhuma linha.

Run: `npm run build`
Expected: build verde com `/people/[id]` nas rotas.

- [ ] **Step 6: Verificar acentuação**

Run: `grep -c 'u00' src/components/people/*.tsx 'src/app/(app)/people/[id]/page.tsx'`
Expected: `0` em todos.

- [ ] **Step 7: Commit**

```bash
git add src/components/people 'src/app/(app)/people'
git commit -m "feat(people): ficha da pessoa com relações e conflitos

O seletor de 'quem fica de fora' só oferece as duas pontas do conflito —
UI espelhando a constraint excluded_is_an_endpoint. O motivo fica atrás
de um toggle explícito.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Curadoria `/people/events/[id]` — o painel de violações

Esta é a tela que resolve o problema original.

**Files:**
- Create: `src/components/people/ViolationPanel.tsx`
- Create: `src/components/people/InviteRow.tsx`
- Create: `src/app/(app)/people/events/[id]/page.tsx`

**Interfaces:**
- Consumes: `checkGuestList`, `Violation` (Task 3); `usePeople`, `useConflicts`, `useGuestEvents`, `useGuestInvites`, `useUpsertInvite` (Task 4)
- Produces: `<ViolationPanel violations />`, `<InviteRow person status onChangeStatus />` com `onChangeStatus: (personId: string, status: InviteStatus) => void`

- [ ] **Step 1: Criar o `ViolationPanel`**

Criar `src/components/people/ViolationPanel.tsx`:

```tsx
"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"
import type { Violation } from "@/lib/people/conflicts"

const LEVEL_STYLE: Record<Violation["level"], string> = {
  block: "border-danger/40 bg-danger/10 text-danger",
  warn: "border-amber/40 bg-amber/10 text-amber",
  info: "border-on-surface/20 bg-on-surface/5 text-on-surface/70",
}

const LEVEL_TAG: Record<Violation["level"], string> = {
  block: "BLOQUEIO",
  warn: "AVISAR",
  info: "LOGÍSTICA",
}

export const ViolationPanel = memo(function ViolationPanel({
  violations,
}: {
  violations: Violation[]
}) {
  if (violations.length === 0) {
    return (
      <div className="mb-3 border border-on-surface/20 bg-on-surface/5 px-3 py-2 font-mono text-[11px] text-on-surface/50">
        Nenhum conflito nesta lista.
      </div>
    )
  }

  const blocks = violations.filter((v) => v.level === "block").length

  return (
    <div className="mb-3 space-y-1">
      {blocks > 0 ? (
        <p className="font-mono text-[11px] text-danger">
          {blocks} bloqueio(s) — resolva antes de enviar os convites.
        </p>
      ) : null}
      {violations.map((v, i) => (
        <div
          key={`${v.conflictId}-${v.level}-${i}`}
          className={cn("flex items-start gap-2 border px-2 py-1.5", LEVEL_STYLE[v.level])}
        >
          <span className="shrink-0 font-mono text-[10px]">{LEVEL_TAG[v.level]}</span>
          <span className="flex-1 text-[13px]">{v.message}</span>
        </div>
      ))}
    </div>
  )
})
```

- [ ] **Step 2: Criar o `InviteRow`**

Criar `src/components/people/InviteRow.tsx`:

```tsx
"use client"

import { memo } from "react"
import { cn } from "@/lib/utils"
import type { InviteStatus, PersonRow } from "@/lib/types"

const STATUSES: { value: InviteStatus; label: string }[] = [
  { value: "cogitado", label: "?" },
  { value: "convidar", label: "CONVIDAR" },
  { value: "convidado", label: "CONVIDADO" },
  { value: "confirmado", label: "CONFIRMOU" },
  { value: "recusou", label: "RECUSOU" },
  { value: "vetado", label: "VETADO" },
]

interface Props {
  person: PersonRow
  status: InviteStatus
  hasBlock: boolean
  onChangeStatus: (personId: string, status: InviteStatus) => void
}

export const InviteRow = memo(function InviteRow({
  person,
  status,
  hasBlock,
  onChangeStatus,
}: Props) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-on-surface/10 px-2 py-1.5",
        hasBlock && "bg-danger/5",
      )}
    >
      <span className="min-w-0 flex-1 truncate text-sm text-on-surface">
        {person.name}
        {hasBlock ? <span className="ml-2 font-mono text-[10px] text-danger">⚠</span> : null}
      </span>
      <select
        className="shrink-0 border border-on-surface/20 bg-surface px-1.5 py-1 font-mono text-[10px] text-on-surface"
        value={status}
        onChange={(e) => onChangeStatus(person.id, e.target.value as InviteStatus)}
      >
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>{s.label}</option>
        ))}
      </select>
    </div>
  )
})
```

- [ ] **Step 3: Criar a página do evento**

Criar `src/app/(app)/people/events/[id]/page.tsx`:

```tsx
"use client"

import { useCallback, useMemo, use } from "react"
import Link from "next/link"
import { useTitle } from "@/lib/useTitle"
import { SectionErrorBoundary } from "@/components/SectionErrorBoundary"
import { usePeople, useConflicts, useGuestEvents, useGuestInvites, useUpsertInvite } from "@/lib/queries/people"
import { checkGuestList } from "@/lib/people/conflicts"
import { ViolationPanel } from "@/components/people/ViolationPanel"
import { InviteRow } from "@/components/people/InviteRow"
import type { InviteStatus } from "@/lib/types"

export default function GuestEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: eventId } = use(params)
  const { data: people = [] } = usePeople()
  const { data: conflicts = [] } = useConflicts()
  const { data: events = [] } = useGuestEvents()
  const { data: invites = [], isLoading } = useGuestInvites(eventId)
  const upsertInvite = useUpsertInvite()

  const event = useMemo(() => events.find((e) => e.id === eventId) ?? null, [events, eventId])
  useTitle(event ? `${event.name} · Convidados` : "Evento · Suganuma Ops Hub")

  const statusByPerson = useMemo(() => {
    const map = new Map<string, InviteStatus>()
    for (const i of invites) map.set(i.person_id, i.status)
    return map
  }, [invites])

  const violations = useMemo(
    () =>
      checkGuestList(
        invites.map((i) => ({ person_id: i.person_id, status: i.status })),
        conflicts,
        people.map((p) => ({ id: p.id, name: p.name })),
      ),
    [invites, conflicts, people],
  )

  const blockedPeople = useMemo(() => {
    const ids = new Set<string>()
    for (const v of violations) {
      if (v.level !== "block") continue
      ids.add(v.subjectId)
      ids.add(v.objectId)
    }
    return ids
  }, [violations])

  const grouped = useMemo(() => {
    const groups = new Map<string, typeof people>()
    for (const p of people) {
      const key = p.household ?? "Sem grupo"
      const list = groups.get(key)
      if (list) list.push(p)
      else groups.set(key, [p])
    }
    return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [people])

  const handleChangeStatus = useCallback(
    (personId: string, status: InviteStatus) => {
      upsertInvite.mutate({ eventId, personId, status })
    },
    [upsertInvite, eventId],
  )

  const counts = useMemo(() => {
    let naLista = 0
    for (const i of invites) {
      if (i.status === "convidar" || i.status === "convidado" || i.status === "confirmado") {
        naLista += 1
      }
    }
    return { naLista, total: people.length }
  }, [invites, people])

  if (!event) {
    return (
      <SectionErrorBoundary>
        <div className="p-4">
          <p className="font-mono text-[11px] text-on-surface/40">Evento não encontrado.</p>
          <Link href="/people" className="font-mono text-[11px] text-accent">← VOLTAR</Link>
        </div>
      </SectionErrorBoundary>
    )
  }

  return (
    <SectionErrorBoundary>
      <div className="p-3">
        <Link href="/people" className="font-mono text-[10px] text-on-surface/40 hover:text-accent">
          ← PESSOAS
        </Link>

        <h1 className="mt-2 text-lg text-on-surface">{event.name}</h1>
        <p className="font-mono text-[11px] text-on-surface/40">
          {counts.naLista} na lista · {counts.total} cadastradas
          {event.capacity ? ` · capacidade ${event.capacity}` : ""}
        </p>

        <div className="mt-3">
          <ViolationPanel violations={violations} />
        </div>

        {isLoading ? <div className="h-32 animate-pulse bg-on-surface/5" /> : null}

        {!isLoading
          ? grouped.map(([household, members]) => (
              <section key={household} className="mb-4">
                <h2 className="mb-1 font-mono text-[10px] tracking-wider text-on-surface/50">
                  {household.toUpperCase()}
                </h2>
                {members.map((p) => (
                  <InviteRow
                    key={p.id}
                    person={p}
                    status={statusByPerson.get(p.id) ?? "cogitado"}
                    hasBlock={blockedPeople.has(p.id)}
                    onChangeStatus={handleChangeStatus}
                  />
                ))}
              </section>
            ))
          : null}
      </div>
    </SectionErrorBoundary>
  )
}
```

- [ ] **Step 4: Adicionar a lista de eventos na página `/people`**

Em `src/app/(app)/people/page.tsx`, adicionar o hook junto dos outros:

```tsx
import { useGuestEvents } from "@/lib/queries/people"
```

e dentro do componente, após `const { data: conflicts = [] } = useConflicts()`:

```tsx
  const { data: events = [] } = useGuestEvents()
```

e logo após o `<div className="mb-3 flex items-center gap-2">...</div>` do topo, antes do bloco de `isLoading`:

```tsx
        {events.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {events.map((e) => (
              <Link
                key={e.id}
                href={`/people/events/${e.id}`}
                className="border border-on-surface/20 px-2 py-1 font-mono text-[10px] text-on-surface/70 hover:border-accent hover:text-accent"
              >
                {e.name.toUpperCase()}
              </Link>
            ))}
          </div>
        ) : null}
```

adicionando `import Link from "next/link"` ao topo do arquivo.

- [ ] **Step 5: Criar o evento do chá de bebê**

Não há UI de criação de evento nesta fatia (YAGNI — é um insert só). Criar direto no banco:

```bash
ssh LeoVM "docker exec -i supabase-db psql -U supabase_admin -d postgres -c \"insert into guest_event (owner_id, name, event_date) select id, 'Chá de bebê', null from auth.users limit 1\""
```
Expected: `INSERT 0 1`.

- [ ] **Step 6: Verificar que compila e builda**

Run: `npx tsc --noEmit 2>&1 | grep 'people/' | head -20`
Expected: nenhuma linha.

Run: `npm run build`
Expected: build verde com `/people/events/[id]` nas rotas.

- [ ] **Step 7: Verificar acentuação**

Run: `grep -c 'u00' src/components/people/*.tsx 'src/app/(app)/people/events/[id]/page.tsx'`
Expected: `0` em todos.

- [ ] **Step 8: Commit**

```bash
git add src/components/people 'src/app/(app)/people'
git commit -m "feat(people): curadoria de convidados com painel de violações

Painel recalculado a cada mudança de status via useMemo sobre
checkGuestList. Pessoas agrupadas por household para convidar em bloco.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Navegação e verificação final

**Files:**
- Modify: `src/components/shell/BottomNav.tsx`
- Modify: `src/components/shell/Sidebar.tsx`
- Modify: `src/components/shell/TopBar.tsx`
- Modify: `src/components/shell/CommandPalette.tsx`

**Interfaces:**
- Consumes: a rota `/people` (Task 6)
- Produces: nada consumido por outras tarefas (última)

- [ ] **Step 1: Adicionar ao menu HUB**

Em `src/components/shell/BottomNav.tsx`, no array `HUB_ITEMS`, adicionar após a entrada de `/projects`:

```ts
  { href: "/people", label: "PPL", desc: "Pessoas" },
```

A `BottomNav` já está no limite de 5 tabs fixos (DASH, INBX, TASKS, FIN, HUB) — a entrada nova vai no HUB, **não** na barra.

- [ ] **Step 2: Adicionar à Sidebar**

Run: `grep -n 'href:' src/components/shell/Sidebar.tsx`

Adicionar uma entrada `/people` seguindo exatamente a forma das entradas existentes (o array pode exigir um campo `icon` em JSX — copiar a estrutura de um vizinho e trocar o path do SVG por um genérico de "pessoas"). Se o ícone for SVG inline, respeitar a regra do projeto: **margem de ≥1.5px do stroke à borda do viewBox**, senão o stroke é clipado.

- [ ] **Step 3: Adicionar o rótulo no TopBar**

Em `src/components/shell/TopBar.tsx`, no objeto `PAGE_LABELS`, adicionar:

```ts
  "/people": "PEOPLE HUB",
```

O `TopBar` já ordena por longest-match, então `/people/events` não precisa de entrada própria (herda o rótulo).

- [ ] **Step 4: Adicionar ao CommandPalette**

Run: `grep -n 'href\|/projects' src/components/shell/CommandPalette.tsx | head -20`

Adicionar `/people` ao grupo de navegação, seguindo a forma exata das entradas existentes.

- [ ] **Step 5: Rodar a suíte completa**

Run: `npm test`
Expected: PASS. Contagem esperada: **130 testes node** — baseline medida de 102 (o `AGENTS.md` diz 94; está desatualizado, a medição em 2026-09-04 deu 102) + 8 (schemas) + 13 (conflitos) + 7 (import).

- [ ] **Step 6: Build com type check ativo**

Run: `npm run build`
Expected: build verde.

`SKIP_TSC=1` no deploy esconde erros de tipo reais — uma sessão anterior deste projeto encontrou ~19 erros latentes ao rodar o build com `tsc` ativo. Este passo é a única barreira antes do deploy.

- [ ] **Step 7: Verificação manual no dev server**

Run: `npm run dev`

Percorrer, nesta ordem:
1. `/people` → criar duas pessoas (ex: "Ana" e "Bia")
2. Abrir a ficha da Ana → criar conflito com a Bia, política `nao_juntos`
3. `/people/events/<id do chá>` → marcar as duas como `CONVIDAR`
4. **Confirmar que o painel mostra um bloqueio vermelho** citando os dois nomes
5. Mudar a Bia para `VETADO` → **confirmar que o bloqueio some**
6. Editar o conflito para `ok_com_ressalva` + os dois `handling`, voltar as duas para `CONVIDAR` → **confirmar 2 linhas no painel** (uma AVISAR, uma LOGÍSTICA)

Se qualquer passo divergir, o bug está no verificador ou no wiring do `useMemo` — não seguir para o deploy.

- [ ] **Step 8: Commit**

```bash
git add src/components/shell
git commit -m "feat(people): navegação — HUB, Sidebar, TopBar e CommandPalette

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 9: Deploy**

Confirmar com o Leo antes de rodar. O deploy é `git push origin feat/people-graph:main` (fast-forward), que dispara o workflow. O gate de testes (`npm ci` + `npx vitest run`) roda **antes** do SSH — build não sobe com teste vermelho.

Após o deploy, verificar:

```bash
ssh LeoVM 'docker exec caddy_proxy wget -qO- http://suganuma-ops-hub:3000/sw.js | head -3'
```

---

## Self-Review

**Cobertura do spec:**

| Seção do spec | Task |
|---|---|
| §3 Schema (5 tabelas, RLS, índices, realtime) | 1 |
| §3.1 `household` como texto | 1, 8 (agrupamento) |
| §2.5 dois eixos, `excluded_person_id`, sem `condicional` | 1, 2, 3, 7 |
| §4 Verificador, 4 regras + os 2 casos explicitados | 3 |
| §4 único intérprete de `invite_policy` | 3 (doc), 8 (painel consome `Violation[]`) |
| §5 UI `/people`, `/people/[id]`, `/people/events/[id]`, navegação | 6, 7, 8, 9 |
| §6.1 fora do Qdrant/`search_vector` | 1 (migration não cria `search_vector`) |
| §6.2 tools MCP | **fatia 2** — fora deste plano, conforme §9 do spec |
| §6.3 sem rota de Agent API | 1 (nenhuma rota criada) |
| §7.1 export/import com `PRESERVE_ID_TABLES` | 5 |
| §7.2 realtime | 4 |
| §7.3 paginação | 4 |
| §8 testes | 2, 3, 5 |
| §10 runbook da migration | 1 |

**Lacuna consciente:** a UI de criação de `guest_event` não existe nesta fatia — o evento é criado por SQL (Task 8, Step 5). É um insert único e YAGNI; se surgir um segundo evento, um dialog de 30 linhas resolve.

**Consistência de tipos:** `Violation` (Task 3) é consumido em Task 8 com os campos `level`, `conflictId`, `subjectId`, `objectId`, `message` — todos definidos. `InviteStatus` (Task 2) é usado em Tasks 4 e 8. `PersonConflict` (schema, Task 2) é o parâmetro de `useCreateConflict`/`useUpdateConflict` (Task 4) e o retorno de `onSubmit` do `ConflictFormDialog` (Task 7). `cleanRowsForImport` (Task 5) tem a mesma assinatura no teste e na implementação.

**Pontos de atenção durante a execução:**

1. **Task 6, Step 4** e **Task 9, Steps 2 e 4** mandam ler a assinatura real antes de escrever (`useUndoToast`, `Sidebar`, `CommandPalette`). Não são placeholders — são pontos onde adivinhar a API causaria erro de build, e a leitura é de um comando só.
2. **Task 7, Step 4**: `params` como `Promise` é a API do Next.js 16. Confirmar antes de escrever, não depois.
3. **A pendência do spec §2.5** continua aberta: o enum não foi validado contra conflitos reais. O momento de descobrir que ele está errado é o Step 7 da Task 9 — cadastrando os primeiros casos de verdade.
