-- Add linked_task_id to note table (integrates Notes ↔ Tasks)
alter table note add column if not exists linked_task_id uuid references task(id) on delete set null;

create index if not exists idx_note_linked_task on note(linked_task_id);
