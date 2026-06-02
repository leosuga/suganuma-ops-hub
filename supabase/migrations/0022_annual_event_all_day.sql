-- Migration 0022: Add is_all_day flag for day-long events
-- Events without specific times (vacations, holidays) appear as banners

ALTER TABLE annual_event
ADD COLUMN is_all_day BOOLEAN DEFAULT FALSE;

CREATE INDEX idx_annual_event_all_day ON annual_event(is_all_day);

COMMENT ON COLUMN annual_event.is_all_day IS 'Event occupies the full day, shown as top banner instead of timed block';
