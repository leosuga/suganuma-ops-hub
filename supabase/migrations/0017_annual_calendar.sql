CREATE TABLE annual_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT annual_event_dates_check CHECK (end_date >= start_date)
);

ALTER TABLE annual_event ENABLE ROW LEVEL SECURITY;

CREATE POLICY annual_event_select ON annual_event FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY annual_event_insert ON annual_event FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY annual_event_update ON annual_event FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY annual_event_delete ON annual_event FOR DELETE USING (owner_id = auth.uid());

CREATE INDEX idx_annual_event_owner ON annual_event(owner_id);
CREATE INDEX idx_annual_event_dates ON annual_event(start_date, end_date);

ALTER PUBLICATION supabase_realtime ADD TABLE annual_event;
