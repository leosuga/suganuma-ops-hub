-- Tokens de autenticação para agentes externos (OpenClaw, Hermes, Claude Desktop).
-- Armazena apenas o hash SHA-256 do token; o valor bruto é mostrado uma única vez.

create table agent_token (
  id           uuid        primary key default gen_random_uuid(),
  owner_id     uuid        not null references auth.users(id) on delete cascade,
  name         text        not null,
  token_hash   text        not null unique,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

alter table agent_token enable row level security;

create policy "agent_token_owner"
  on agent_token
  using (owner_id = auth.uid());
