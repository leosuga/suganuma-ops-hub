-- Idempotency tracking for webhook events.
-- Prevents replay attacks: each (source, event_key) pair can only be processed once.

create table if not exists webhook_event (
  id           uuid primary key default gen_random_uuid(),
  source       text not null,  -- "email-to-task" | "csv-from-bank" | "deploy-status"
  event_key    text not null,  -- deterministic hash or payload-provided id
  processed_at timestamptz not null default now()
);

-- Only one processed event per (source, event_key)
create unique index if not exists idx_webhook_event_source_key on webhook_event(source, event_key);

-- TTL helper: purge events older than 7 days to keep the table small
-- (run via scheduled job or manually; not automated here)
create index if not exists idx_webhook_event_processed_at on webhook_event(processed_at desc);

-- Service role only — webhooks use createServiceClient()
alter table webhook_event enable row level security;
create policy "webhook_event_service_only" on webhook_event
  as restrictive
  using (false)
  with check (false);