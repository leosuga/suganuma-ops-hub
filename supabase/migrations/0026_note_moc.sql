-- Note enhancements v3: MOC support + review tracking

-- Add is_moc flag for Maps of Content
alter table note add column if not exists is_moc boolean default false;

-- Add last_review date for area review tracking
alter table note add column if not exists last_review date;

-- Index for MOC queries
create index if not exists idx_note_owner_moc on note(owner_id, is_moc, updated_at desc) where is_moc = true;

-- Index for area review queries
create index if not exists idx_note_owner_review on note(owner_id, para, last_review) where para = 'areas';
