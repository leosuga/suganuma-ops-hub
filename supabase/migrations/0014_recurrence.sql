ALTER TABLE task ADD COLUMN IF NOT EXISTS recurrence text;
ALTER TABLE task ADD CONSTRAINT task_recurrence_check CHECK (recurrence IN ('daily', 'weekly', 'monthly'));
