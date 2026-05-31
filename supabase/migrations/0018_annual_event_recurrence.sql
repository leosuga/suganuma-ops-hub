-- Add recurrence to annual_event
ALTER TABLE annual_event ADD COLUMN recurrence TEXT DEFAULT 'none';
CREATE INDEX idx_annual_event_recurrence ON annual_event(recurrence);

-- Enum constraint via check
ALTER TABLE annual_event ADD CONSTRAINT annual_event_recurrence_check 
  CHECK (recurrence IN ('none', 'weekly', 'monthly', 'yearly'));
