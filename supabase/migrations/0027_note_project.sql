-- Add project_id to note for project context
alter table note add column if not exists project_id uuid references project(id) on delete set null;

create index if not exists idx_note_project on note(project_id);
