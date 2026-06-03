alter table annual_event add column location text;

create index idx_annual_event_location on annual_event(location) where location is not null;

comment on column annual_event.location is 'Location or venue for calendar events (e.g., Sala 102, Hospital Central)';
