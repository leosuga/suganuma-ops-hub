-- Web Push subscriptions — 1 linha por dispositivo (endpoint único por browser).
-- A subscription contém o endpoint do push service (FCM/APNs/Mozilla) + as chaves
-- de criptografia (p256dh/auth) que permitem ao servidor cifrar o payload.

create table if not exists push_subscription (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz default now(),
  last_used_at timestamptz
);

create index if not exists idx_push_subscription_owner on push_subscription(owner_id);

-- RLS: o usuário gerencia as PRÓPRIAS subscriptions via client (anon key).
alter table push_subscription enable row level security;

create policy push_subscription_select_own on push_subscription
  for select using (auth.uid() = owner_id);
create policy push_subscription_insert_own on push_subscription
  for insert with check (auth.uid() = owner_id);
create policy push_subscription_delete_own on push_subscription
  for delete using (auth.uid() = owner_id);