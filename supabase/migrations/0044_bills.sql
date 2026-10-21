-- Contas a pagar / despesas fixas (item 6 do backlog 2026-08).
--
-- A tabela `transaction` só registra o PASSADO (occurred_on). Faltava o que
-- VENCE: aluguel, internet, energia, assinatura — o que permite saber "quanto
-- já caiu neste mês" e "o que vence nos próximos dias".
--
-- `recurring_transaction` = a despesa fixa (dia do mês do vencimento).
-- `bill_payment` = o que já foi pago em cada mês (um pagamento em outubro não
-- marca novembro como pago — por isso o estado é por período, e não uma
-- coluna `paid` na própria despesa fixa).

create table if not exists recurring_transaction (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users on delete cascade,
  description   text not null,
  amount        numeric not null check (amount > 0),
  kind          text not null default 'expense'
                check (kind in ('income','expense','transfer','tax')),
  category      text,
  account_id    uuid references account(id) on delete set null,
  day_of_month  int not null default 10 check (day_of_month between 1 and 31),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

create table if not exists bill_payment (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users on delete cascade,
  recurring_id  uuid not null references recurring_transaction(id) on delete cascade,
  period        text not null,          -- 'YYYY-MM'
  paid_at       timestamptz not null default now(),
  unique (owner_id, recurring_id, period)
);

create index if not exists idx_recurring_owner on recurring_transaction(owner_id, active);
create index if not exists idx_bill_payment_period on bill_payment(owner_id, period);

alter table recurring_transaction enable row level security;
create policy "recurring_transaction_owner" on recurring_transaction
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter table bill_payment enable row level security;
create policy "bill_payment_owner" on bill_payment
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

alter publication supabase_realtime add table recurring_transaction;
