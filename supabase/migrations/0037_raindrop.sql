-- Raindrop → Hub Notes bridge (ponte de curadoria automática)
--
-- Única mudança de schema necessária para v1: permitir `source = 'raindrop'`
-- na tabela inbox_item, para que o cron de sincronização possa capturar itens
-- acionáveis do Raindrop no Inbox (Variante C: reference → nota, actionable → inbox).
--
-- O cursor de sincronização e a deduplicação NÃO exigem schema novo:
--   - cursor: nota pinned com tag `raindrop-sync-state` (corpo = último timestamp)
--   - dedup:  tabela `webhook_event` (unique `(source, event_key)`), reusando
--             `checkWebhookIdempotency("raindrop", raindrop_id)`.

-- O check constraint original foi criado inline na migration 0032, então o
-- Postgres gerou um nome automático. Localizamos e removemos por inspeção do
-- catálogo (em vez de adivinhar o nome), e re-adicionamos com nome explícito.
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'inbox_item'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%source%';
  if cname is not null then
    execute format('alter table inbox_item drop constraint %I', cname);
  end if;
end $$;

alter table inbox_item
  add constraint inbox_item_source_check
  check (source in ('manual','telegram','audio','email','webhook','mcp','raindrop'));
