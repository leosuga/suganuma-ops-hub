-- Módulo Bebê — ficha da criança e registro da rotina (mamada, fralda, sono...).
-- O cronograma de vacinas/consultas NÃO mora aqui: é gerado como tasks normais
-- num projeto (child.project_id), para aparecer no Cockpit/Calendário/push.

-- ----------------------------------------------------------------- child
create table if not exists child (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users on delete cascade,
  name            text not null,
  birth_at        timestamptz not null,
  sex             text,
  birth_weight_g  int check (birth_weight_g is null or birth_weight_g > 0),
  birth_length_cm numeric check (birth_length_cm is null or birth_length_cm > 0),
  birth_head_cm   numeric check (birth_head_cm is null or birth_head_cm > 0),
  blood_type      text,
  notes           text,
  project_id      uuid references project on delete set null,
  pregnancy_id    uuid references pregnancy on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_child_owner on child(owner_id);

alter table child enable row level security;
drop policy if exists "child_owner" on child;
create policy "child_owner" on child
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ------------------------------------------------------------- baby_log
create table if not exists baby_log (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users on delete cascade,
  child_id   uuid not null references child on delete cascade,
  kind       text not null
             check (kind in ('feed','diaper','sleep','med','growth','temp','note')),
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  data       jsonb not null default '{}'::jsonb,
  notes      text,
  created_at timestamptz not null default now(),
  constraint baby_log_end_after_start check (ended_at is null or ended_at >= started_at)
);

create index if not exists idx_baby_log_child_started
  on baby_log(owner_id, child_id, started_at desc);

alter table baby_log enable row level security;
drop policy if exists "baby_log_owner" on baby_log;
create policy "baby_log_owner" on baby_log
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- -------------------------------------------------------------- realtime
-- Re-executável: add table falha se a tabela já estiver na publication.
do $$
declare t text;
begin
  foreach t in array array['child','baby_log']
  loop
    begin
      execute format('alter publication supabase_realtime add table %I', t);
    exception when duplicate_object then
      null;
    end;
  end loop;
end $$;
