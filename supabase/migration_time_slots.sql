-- Run this in the Supabase SQL editor for your EXISTING project.
-- Only ADDS two columns — does not touch, rename, or delete any existing data.

alter table visitors add column if not exists proposed_time_slots jsonb;
alter table visitors add column if not exists selected_time_slot timestamptz;

-- proposed_time_slots: a JSON array of ISO timestamp strings the host offers,
--   e.g. ["2026-08-15T14:00:00.000Z", "2026-08-15T16:00:00.000Z"]
-- selected_time_slot: the one the guest actually picked, if any.
