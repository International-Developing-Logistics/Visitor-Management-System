-- Run this in the Supabase SQL editor for your EXISTING project.
-- Only widens the allowed values for the `status` column — does not touch,
-- rename, or delete any existing rows.

do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'visitors'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table visitors drop constraint %I', con.conname);
  end loop;
end $$;

alter table visitors add constraint visitors_status_check
  check (status in ('requested', 'invited', 'pre_registered', 'checked_in', 'checked_out'));
