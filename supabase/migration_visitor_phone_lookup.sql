-- Run this in the Supabase SQL editor for your EXISTING project.
-- Purely additive: adds a normalized phone_digits column to `visitors`,
-- kept in sync automatically by a trigger, plus an index on it. This is
-- what powers "Automatic recognition of returning visitors" - see
-- app/api/visitors/lookup/route.js and VISITOR_FEATURES_DESIGN.md Part 3.
--
-- Why a trigger instead of a generated column: Postgres only allows a
-- STORED generated column's expression to use IMMUTABLE functions, and
-- regexp_replace() is not marked IMMUTABLE in Postgres even though the
-- pattern used here ('\D', strip-non-digits) always is in practice - so a
-- plain trigger is the simplest way to keep this in sync without fighting
-- that restriction, and it means no existing INSERT/UPDATE statement
-- anywhere in the app needs to remember to populate it.

alter table visitors add column if not exists phone_digits text;

create or replace function set_visitor_phone_digits() returns trigger as $$
begin
  new.phone_digits := regexp_replace(coalesce(new.phone, ''), '\D', '', 'g');
  if new.phone_digits = '' then
    new.phone_digits := null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_visitor_phone_digits on visitors;
create trigger trg_set_visitor_phone_digits
  before insert or update of phone on visitors
  for each row execute function set_visitor_phone_digits();

-- Backfill existing rows (the trigger only fires going forward).
update visitors set phone_digits = regexp_replace(coalesce(phone, ''), '\D', '', 'g');
update visitors set phone_digits = null where phone_digits = '';

create index if not exists idx_visitors_phone_digits on visitors(phone_digits);
