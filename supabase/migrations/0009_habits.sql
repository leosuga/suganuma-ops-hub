-- Habits Tracker
create table if not exists habit_track (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  name        text not null,
  active      boolean default true,
  created_at  timestamptz default now()
);

create table if not exists habit_entry (
  id          uuid primary key default gen_random_uuid(),
  habit_id    uuid references habit_track on delete cascade,
  done_on     date not null,
  notes       text,
  created_at  timestamptz default now()
);

create index if not exists idx_habit_track_owner on habit_track(owner_id, active);
create index if not exists idx_habit_entry_habit_done on habit_entry(habit_id, done_on desc);

alter table habit_track enable row level security;
alter table habit_entry enable row level security;

create policy "habit_track_owner" on habit_track
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "habit_entry_owner" on habit_entry
  using (exists (select 1 from habit_track h where h.id = habit_id and h.owner_id = auth.uid()))
  with check (exists (select 1 from habit_track h where h.id = habit_id and h.owner_id = auth.uid()));

alter publication supabase_realtime add table habit_track;
alter publication supabase_realtime add table habit_entry;
