CREATE TABLE IF NOT EXISTS budget (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month text NOT NULL,
  target numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_id, month)
);

ALTER TABLE budget ENABLE ROW LEVEL SECURITY;

CREATE POLICY budget_select ON budget FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY budget_insert ON budget FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY budget_update ON budget FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY budget_delete ON budget FOR DELETE USING (owner_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE budget;
