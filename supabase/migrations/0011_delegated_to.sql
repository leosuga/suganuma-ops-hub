-- Add delegated_to to task table
alter table task add column if not exists delegated_to text;
