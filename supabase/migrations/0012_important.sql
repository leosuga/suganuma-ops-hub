-- Add important flag to task table (Eisenhower Matrix)
alter table task add column if not exists important boolean not null default false;
