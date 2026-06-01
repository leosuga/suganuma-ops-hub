-- Migration 0019: Add project_id to annual_event table
-- Links calendar events to projects for unified tracking

ALTER TABLE annual_event
ADD COLUMN project_id UUID REFERENCES project(id) ON DELETE SET NULL;

CREATE INDEX idx_annual_event_project_id ON annual_event(project_id);

-- Update RLS to allow reading project info via FK
COMMENT ON COLUMN annual_event.project_id IS 'Optional link to a project for unified planning';
