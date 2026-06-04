-- Migration 0028: Add favorited flag to note
alter table note add column if not exists favorited boolean default false;
