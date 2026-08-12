-- Run this in the Supabase SQL editor for your EXISTING project.
-- Purely additive — adds one nullable column, doesn't touch existing data.

alter table visitors add column if not exists proposed_alternative_time timestamptz;

-- Set when a guest doesn't like any of the offered proposed_time_slots and
-- suggests their own preferred time instead, for the host to review/confirm
-- (typically by an admin copying it into selected_time_slot via /admin).
