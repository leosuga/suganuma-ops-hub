-- Inbox: captura de atrito zero com triagem posterior
-- Resolve o "paradoxo do mind dump": captura sem precisar categorizar,
-- triagem acontece depois com contexto completo.

create table if not exists inbox_item (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  content     text not null,
  source      text not null default 'manual'
              check (source in ('manual','telegram','audio','email','webhook','mcp')),
  ai_payload  jsonb,
  status      text not null default 'unprocessed'
              check (status in ('unprocessed','triaged','archived')),
  created_at  timestamptz not null default now(),
  triaged_at  timestamptz
);

create index if not exists idx_inbox_owner_status on inbox_item(owner_id, status, created_at desc);

alter table inbox_item enable row level security;
create policy "inbox_item_owner" on inbox_item
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter publication supabase_realtime add table inbox_item;