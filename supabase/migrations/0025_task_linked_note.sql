-- Add linked_note_id to task table for bidirectional Note↔Task integration
alter table task add column if not exists linked_note_id uuid references note(id) on delete set null;

create index if not exists idx_task_linked_note on task(linked_note_id);
