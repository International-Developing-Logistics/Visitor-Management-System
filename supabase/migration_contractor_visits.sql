-- Run this in the Supabase SQL editor for your EXISTING project.
-- Safe to run more than once — CREATE TABLE / INDEX all use IF NOT EXISTS.
--
-- Adds a visit log for contractors: unlike the `contractors` table itself
-- (one row per pass, current status only), a contractor with a multi-entry
-- pass can come and go many times over their validity window, and the
-- admin dashboard needs to log every one of those visits, not just the
-- current on/off-site state. One row per visit, same "open row = currently
-- checked in" pattern already used for `vehicle_movements`
-- (checked_out_at is null while a vehicle is still out).
--
-- checked_in_at is never null (a row only exists once someone is checked
-- in); checked_out_at is null while the contractor is still on site.
-- checked_in_by / checked_out_by store the admin's email for an audit
-- trail, same as vehicle_movements.checked_out_by.

create table if not exists contractor_visits (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references contractors (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by text,
  checked_out_at timestamptz,
  checked_out_by text,
  created_at timestamptz not null default now()
);

-- Fast lookup of "is this contractor currently on site" and "give me
-- every open visit" — both filter on checked_out_at is null.
create index if not exists contractor_visits_open_idx
  on contractor_visits (contractor_id)
  where checked_out_at is null;

-- Fast "history for this contractor, most recent first".
create index if not exists contractor_visits_contractor_id_checked_in_at_idx
  on contractor_visits (contractor_id, checked_in_at desc);

-- RLS enabled with no public policies — same pattern as `contractors`.
-- All access goes through app/api/admin/contractors/[id]/visits using the
-- service role key.
alter table contractor_visits enable row level security;
