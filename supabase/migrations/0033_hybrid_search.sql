-- Hybrid RAG: FTS (tsvector + GIN) for keyword search
-- Combined with Qdrant vector search via Reciprocal Rank Fusion (RRF) in app layer.
-- Portuguese text config for proper stemming and accent handling.

-- ── Note: tsvector column + GIN index + trigger ──

alter table note add column if not exists search_vector tsvector;

create index if not exists idx_note_search_vector on note using gin(search_vector);

create or replace function note_search_vector_update() returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(new.content, '')), 'B');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_note_search_vector on note;
create trigger trg_note_search_vector
  before insert or update of title, content on note
  for each row execute function note_search_vector_update();

-- Backfill existing notes
update note
  set search_vector = setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
                      setweight(to_tsvector('portuguese', coalesce(content, '')), 'B')
  where search_vector is null;

-- ── Task: tsvector column + GIN index + trigger ──

alter table task add column if not exists search_vector tsvector;

create index if not exists idx_task_search_vector on task using gin(search_vector);

create or replace function task_search_vector_update() returns trigger as $$
begin
  new.search_vector :=
    setweight(to_tsvector('portuguese', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(new.notes, '')), 'B');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_task_search_vector on task;
create trigger trg_task_search_vector
  before insert or update of title, notes on task
  for each row execute function task_search_vector_update();

-- Backfill existing tasks
update task
  set search_vector = setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
                      setweight(to_tsvector('portuguese', coalesce(notes, '')), 'B')
  where search_vector is null;