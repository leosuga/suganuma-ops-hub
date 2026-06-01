-- Migration 0020: Add series_id to annual_event for recurring event groups
-- Allows editing/deleting entire series at once

ALTER TABLE annual_event
ADD COLUMN series_id UUID DEFAULT NULL;

CREATE INDEX idx_annual_event_series_id ON annual_event(series_id);

COMMENT ON COLUMN annual_event.series_id IS 'Groups events created from the same recurrence pattern';
