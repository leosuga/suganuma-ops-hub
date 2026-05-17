-- Projects table
create table if not exists project (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  name        text not null,
  description text,
  color       text not null default '#55D7ED',
  status      text not null default 'active' check (status in ('active','done','paused')),
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists project_owner_status_idx on project(owner_id, status);

alter table project enable row level security;

create policy "users can manage own projects"
  on project for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create or replace trigger project_updated_at
  before update on project for each row execute procedure update_updated_at_column();

-- Add project_id FK to task table
alter table task add column if not exists project_id uuid references project(id) on delete set null;

create index if not exists task_project_idx on task(project_id);

-- Realtime
alter publication supabase_realtime add table project;
