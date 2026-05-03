-- Notes / Journal
create table if not exists note (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  title       text not null,
  content     text,
  tags         text[] default '{}',
  pinned      boolean default false,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create index if not exists idx_note_owner_updated
  on note(owner_id, updated_at desc);

create index if not exists idx_note_owner_pinned
  on note(owner_id, pinned, updated_at desc);

alter table note enable row level security;

create policy "note_owner"
  on note
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create or replace trigger note_updated_at
  before update on note
  for each row execute procedure update_updated_at_column();

-- Realtime
alter publication supabase_realtime add table note;
