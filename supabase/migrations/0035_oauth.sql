-- OAuth 2.1 authorization server para o endpoint MCP.
--
-- Permite conectar o Ops Hub como custom connector no claude.ai (e em qualquer
-- cliente MCP que fale OAuth), sem depender de tokens estáticos.
--
-- Nenhuma tabela aqui é acessível pelo usuário final: todo o acesso passa pelo
-- service role nas rotas /authorize, /api/oauth/token e /api/mcp.

-- Clientes registrados via Dynamic Client Registration (RFC 7591).
-- Clientes que usam CIMD não são persistidos — o client_id é uma URL resolvida em runtime.
create table oauth_client (
  id             uuid        primary key default gen_random_uuid(),
  client_id      text        not null unique,
  client_name    text,
  redirect_uris  jsonb       not null default '[]'::jsonb,
  created_at     timestamptz not null default now()
);

alter table oauth_client enable row level security;
create policy "oauth_client_service_only" on oauth_client using (false);

-- Authorization codes: uso único, curta duração, ligados ao PKCE challenge.
create table oauth_authorization_code (
  id             uuid        primary key default gen_random_uuid(),
  code_hash      text        not null unique,
  owner_id       uuid        not null references auth.users(id) on delete cascade,
  client_id      text        not null,
  redirect_uri   text        not null,
  scope          text        not null default '',
  code_challenge text        not null,
  resource       text,
  expires_at     timestamptz not null,
  used_at        timestamptz,
  created_at     timestamptz not null default now()
);

alter table oauth_authorization_code enable row level security;
create policy "oauth_code_service_only" on oauth_authorization_code using (false);

create index oauth_authorization_code_expires_idx on oauth_authorization_code (expires_at);

-- Access tokens + refresh tokens. O refresh é rotacionado na própria linha:
-- gravar o novo hash invalida o anterior no mesmo instante.
create table oauth_token (
  id                 uuid        primary key default gen_random_uuid(),
  owner_id           uuid        not null references auth.users(id) on delete cascade,
  client_id          text        not null,
  scope              text        not null default '',
  access_token_hash  text        not null unique,
  refresh_token_hash text        unique,
  access_expires_at  timestamptz not null,
  refresh_expires_at timestamptz,
  created_at         timestamptz not null default now(),
  last_used_at       timestamptz,
  revoked_at         timestamptz
);

alter table oauth_token enable row level security;
create policy "oauth_token_service_only" on oauth_token using (false);

create index oauth_token_owner_idx on oauth_token (owner_id, created_at desc);
create index oauth_token_access_expires_idx on oauth_token (access_expires_at);

-- Limpeza de codes expirados e tokens revogados/expirados há mais de 30 dias.
-- Chamada sob demanda (não há pg_cron garantido no projeto).
create or replace function prune_oauth_artifacts()
returns void
language sql
security definer
set search_path = public
as $$
  delete from oauth_authorization_code where expires_at < now() - interval '1 day';
  delete from oauth_token
   where (revoked_at is not null and revoked_at < now() - interval '30 days')
      or (refresh_expires_at is not null and refresh_expires_at < now() - interval '30 days')
      or (refresh_token_hash is null and access_expires_at < now() - interval '30 days');
$$;
