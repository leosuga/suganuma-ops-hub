-- Migration 0021: Add start_time and end_time to annual_event for timed events

ALTER TABLE annual_event
ADD COLUMN start_time TIME DEFAULT NULL,
ADD COLUMN end_time TIME DEFAULT NULL;

COMMENT ON COLUMN annual_event.start_time IS 'Optional start time for events with specific hours';
COMMENT ON COLUMN annual_event.end_time IS 'Optional end time for events with specific hours';
