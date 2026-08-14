-- Run this in the Supabase SQL editor for your EXISTING project.
-- Purely additive — every existing row gets `facility = 'harmony'`
-- (today's default/only facility), so nothing about current behavior
-- changes. New IDL pages will tag their own records 'idl'.

alter table visitors add column if not exists facility text not null default 'harmony';

do $$
begin
  alter table visitors add constraint visitors_facility_check
    check (facility in ('harmony', 'idl'));
exception
  when duplicate_object then null;
end $$;

create index if not exists visitors_facility_idx on visitors(facility);
