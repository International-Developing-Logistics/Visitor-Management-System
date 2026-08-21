-- Run this in the Supabase SQL editor for your EXISTING project.
-- All additive — no existing data is touched, renamed, or deleted.

-- Vehicles: track when an approved request's vehicle is returned, so we
-- know whether it's currently "in use" (approved AND not yet returned).
alter table vehicle_requests add column if not exists returned_at timestamptz;

-- Equipment: same "in use" tracking, PLUS multi-select support (an
-- equipment request can now cover more than one item) and an optional
-- third-party rental request for equipment not in your own inventory.
-- The original `equipment` column is left untouched for historical rows —
-- new requests use `equipment_items` (an array) instead.
alter table equipment_requests add column if not exists equipment_items text[];
alter table equipment_requests add column if not exists external_rental_request text;
alter table equipment_requests add column if not exists returned_at timestamptz;

-- Equipment's `equipment` (singular) column is no longer required for new
-- rows, since equipment_items covers it — relax the not-null constraint so
-- new multi-select submissions don't need to fill it in too.
alter table equipment_requests alter column equipment drop not null;
