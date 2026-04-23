create table if not exists health_log (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid not null references auth.users on delete cascade,
  kind      text not null,
  value     jsonb not null,
  logged_at timestamptz default now()
);

create table if not exists pregnancy (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid not null references auth.users on delete cascade,
  due_date  date,
  week      int,
  notes     text,
  created_at timestamptz default now()
);

create table if not exists appointment (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users on delete cascade,
  title      text not null,
  starts_at  timestamptz not null,
  location   text,
  kind       text,
  created_at timestamptz default now()
);

create table if not exists protocol (
  id        uuid primary key default gen_random_uuid(),
  owner_id  uuid not null references auth.users on delete cascade,
  name      text not null,
  schedule  jsonb,
  active    bool default true,
  created_at timestamptz default now()
);

create table if not exists protocol_entry (
  id          uuid primary key default gen_random_uuid(),
  protocol_id uuid references protocol on delete cascade,
  done_on     date not null,
  notes       text,
  created_at  timestamptz default now()
);

alter table health_log      enable row level security;
alter table pregnancy       enable row level security;
alter table appointment     enable row level security;
alter table protocol        enable row level security;
alter table protocol_entry  enable row level security;

do $$ begin
  create policy "users can manage own health_logs"
    on health_log for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users can manage own pregnancies"
    on pregnancy for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users can manage own appointments"
    on appointment for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users can manage own protocols"
    on protocol for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users can manage own protocol_entries"
    on protocol_entry for all
    using (exists (select 1 from protocol p where p.id = protocol_id and p.owner_id = auth.uid()))
    with check (exists (select 1 from protocol p where p.id = protocol_id and p.owner_id = auth.uid()));
exception when duplicate_object then null;
end $$;
