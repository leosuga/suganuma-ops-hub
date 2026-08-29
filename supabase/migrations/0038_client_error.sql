-- Client error log — captura de erros do browser (window.onerror,
-- unhandledrejection, onError de query/mutation) para diagnóstico pós-deploy.
--
-- Escrita: apenas pela API server-side (service role) via /api/client-log.
-- Leitura: apenas service role. RLS deny-all — sem acesso direto do client.

create table if not exists client_error (
  id          uuid primary key default gen_random_uuid(),
  level       text not null default 'error',          -- error | warn
  ctx         text not null default 'client',
  message     text not null,
  stack       text,
  url         text,                                    -- rota onde ocorreu
  user_agent  text,
  release     text,                                    -- BUILD_ID/pacote p/ correlacionar deploy
  extra       jsonb,                                   -- dados adicionais sanitizados
  created_at  timestamptz default now()
);

create index if not exists idx_client_error_created on client_error(created_at desc);
create index if not exists idx_client_error_level on client_error(level, created_at desc);

alter table client_error enable row level security;

-- deny-all: sem policies = ninguém acessa via PostgREST com anon/authenticated.
-- Escrita/leitura só via service role (route /api/client-log).