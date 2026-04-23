do $$ begin
  create type txn_kind as enum ('income','expense','transfer','tax');
exception when duplicate_object then null;
end $$;

create table if not exists account (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users on delete cascade,
  name            text not null,
  kind            text,
  currency        text default 'BRL',
  opening_balance numeric(14,2) default 0,
  created_at      timestamptz default now()
);

create table if not exists transaction (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  account_id  uuid references account on delete set null,
  kind        txn_kind not null,
  amount      numeric(14,2) not null,
  currency    text default 'BRL',
  category    text,
  description text,
  occurred_on date not null,
  created_at  timestamptz default now()
);

create table if not exists csv_import (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users on delete cascade,
  filename      text,
  rows_imported int,
  created_at    timestamptz default now()
);

alter table account     enable row level security;
alter table transaction enable row level security;
alter table csv_import  enable row level security;

do $$ begin
  create policy "users can manage own accounts"
    on account for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users can manage own transactions"
    on transaction for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$ begin
  create policy "users can manage own csv_imports"
    on csv_import for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;
