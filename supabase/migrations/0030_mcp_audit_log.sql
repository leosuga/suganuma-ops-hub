-- Audit log for MCP tool calls

create table if not exists mcp_audit_log (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users on delete cascade,
  tool_name   text not null,
  args        jsonb,
  success     boolean not null,
  error       text,
  duration_ms integer not null default 0,
  created_at  timestamptz default now()
);

create index if not exists idx_mcp_audit_log_owner_created on mcp_audit_log(owner_id, created_at desc);
create index if not exists idx_mcp_audit_log_tool on mcp_audit_log(tool_name, created_at desc);

-- Only service role / server functions should read/write this table.
-- No direct client access via RLS.
alter table mcp_audit_log enable row level security;

create policy "mcp_audit_log_service_only" on mcp_audit_log
  as restrictive
  using (false)
  with check (false);
