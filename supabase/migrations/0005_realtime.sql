-- Habilitar Postgres Changes (Realtime) para as tabelas principais.
-- Aplicar via Supabase Studio SQL Editor.
alter publication supabase_realtime add table task;
alter publication supabase_realtime add table transaction;
alter publication supabase_realtime add table health_log;
