-- Meal Planning
create table if not exists meal (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  name        text not null,
  kind        text default 'recipe',
  tags        text[] default '{}',
  ingredients text[] default '{}',
  prep_time   int,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists meal_plan (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  meal_id     uuid references meal on delete set null,
  date        date not null,
  meal_type   text not null,
  notes       text,
  created_at  timestamptz default now()
);

create index if not exists idx_meal_owner_updated on meal(owner_id, updated_at desc);
create index if not exists idx_meal_plan_owner_date on meal_plan(owner_id, date);

alter table meal      enable row level security;
alter table meal_plan enable row level security;

do $$ begin
  create policy "meal_owner" on meal for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "meal_plan_owner" on meal_plan for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;

create or replace trigger meal_updated_at
  before update on meal
  for each row execute procedure update_updated_at_column();

alter publication supabase_realtime add table meal;
alter publication supabase_realtime add table meal_plan;
