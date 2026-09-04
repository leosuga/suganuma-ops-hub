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
