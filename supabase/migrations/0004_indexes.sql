-- Índices de performance para queries frequentes.
-- task_owner_status_idx já existe (criado em 0001_init.sql).

create index if not exists idx_transaction_owner_date
  on transaction(owner_id, occurred_on desc);

create index if not exists idx_health_log_owner_kind_logged
  on health_log(owner_id, kind, logged_at desc);

create index if not exists idx_appointment_owner_starts
  on appointment(owner_id, starts_at);

create index if not exists idx_protocol_entry_protocol_done
  on protocol_entry(protocol_id, done_on);
