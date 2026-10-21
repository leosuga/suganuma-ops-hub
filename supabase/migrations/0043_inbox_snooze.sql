-- Snooze ("adiar"): a decisão de triagem que faltava — o item fica na fila,
-- mas só volta a aparecer depois da data escolhida (o "Someday/Maybe" do GTD).
--
-- Sem isso, a fila só tem duas saídas: fazer ou descartar. Itens que não são
-- para hoje acabavam arquivados (perdidos) ou parados no topo da fila.

alter table inbox_item add column if not exists snoozed_until date;

-- Índice parcial: só as linhas adiadas (as não adiadas são a maioria).
create index if not exists idx_inbox_snoozed on inbox_item(owner_id, snoozed_until)
  where snoozed_until is not null;
