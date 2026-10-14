-- Orçamento por categoria — meta mensal por categoria (ex.: Bebê, Mercado).
-- O gasto real vem de transaction.category (texto livre); a comparação meta x
-- realizado é feita no app, normalizando caixa e acento.
--
-- category_key é a categoria normalizada pelo app (minúscula, sem acento). Ela é
-- a chave de unicidade: sem a extensão unaccent o Postgres não normaliza sozinho,
-- e "Bebê" / "bebe" não podem virar duas metas.

create table if not exists budget_category (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references auth.users on delete cascade,
  category       text not null,
  category_key   text not null,
  monthly_target numeric not null default 0 check (monthly_target >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint budget_category_unique unique (owner_id, category_key)
);

alter table budget_category enable row level security;
drop policy if exists "budget_category_owner" on budget_category;
create policy "budget_category_owner" on budget_category
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Re-executável: add table falha se a tabela já estiver na publication.
do $$
begin
  begin
    alter publication supabase_realtime add table budget_category;
  exception when duplicate_object then
    null;
  end;
end $$;
