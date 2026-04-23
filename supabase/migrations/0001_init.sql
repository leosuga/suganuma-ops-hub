-- Trigger para updated_at
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Profile
create table if not exists profile (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Enums
-- NOTE: PostgreSQL does not support CREATE TYPE IF NOT EXISTS.
-- Use DO blocks to avoid errors on re-run.
do $$ begin
  create type task_category as enum ('finance','logistics','personal','health');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type task_status as enum ('todo','doing','done','archived');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type task_priority as enum ('low','med','high','urgent');
exception when duplicate_object then null;
end $$;

-- Tasks
create table if not exists task (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  title       text not null,
  notes       text,
  category    task_category not null default 'personal',
  status      task_status   not null default 'todo',
  priority    task_priority not null default 'med',
  due_at      timestamptz,
  completed_at timestamptz,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists task_owner_status_idx on task(owner_id, status, due_at);

create or replace trigger task_updated_at
  before update on task
  for each row execute procedure update_updated_at_column();

-- RLS
alter table profile enable row level security;
alter table task    enable row level security;

do $$ begin
  create policy "users can manage own profile"
    on profile for all using (id = auth.uid()) with check (id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users can manage own tasks"
    on task for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profile (id, display_name)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
