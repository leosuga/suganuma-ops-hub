-- Note enhancements: PARA categorization + daily_date + frontmatter support

-- PARA category: projects | areas | resources | archive
alter table note add column if not exists para text check (para in ('projects', 'areas', 'resources', 'archive'));

-- Daily note date (for linking notes to specific calendar days)
alter table note add column if not exists daily_date date;

-- Index for PARA filtering
create index if not exists idx_note_owner_para on note(owner_id, para, updated_at desc);

-- Index for daily notes lookup
create index if not exists idx_note_owner_daily on note(owner_id, daily_date);

-- Unique constraint: one daily note per day per user
create unique index if not exists idx_note_owner_daily_unique on note(owner_id, daily_date) where daily_date is not null;
