alter table visitors alter column email drop not null;
alter table visitors add column if not exists additional_visitor_count integer not null default 0;
alter table visitors add column if not exists additional_visitor_names text;