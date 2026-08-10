-- Energy level for tasks: filter "tenho 15 min e pouca energia"
-- Values: low (quick wins, pouca energia), med (normal), high (deep work)

alter table task add column if not exists energy_level text
  check (energy_level in ('low', 'med', 'high'));

create index if not exists idx_task_energy on task(owner_id, energy_level);