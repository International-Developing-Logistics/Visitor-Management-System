-- Run this in the Supabase SQL editor for your EXISTING project.
-- Safe to run more than once — every ADD COLUMN is guarded with
-- IF NOT EXISTS and the sequence/function/index are all CREATE ... IF NOT
-- EXISTS / CREATE OR REPLACE.
--
-- Adds the contractor pass approval workflow:
--   - a real "denied" status (alongside the existing pending/active/inactive)
--   - an admin-only optional reason recorded when denying
--   - a short, gate-friendly pass ID (e.g. CP-2026-0001) shown on the pass
--     and in the admin dashboard instead of the long internal UUID
--   - which of the two document options a contractor submitted, and
--     storage paths for the two new document types (a Freezone gate pass,
--     or a passport + Emirates ID pair) — the existing passport_url column
--     is reused for the passport half of the second option
--   - decided_at, set the moment an admin approves or denies
--
-- Approving a pending registration goes straight from 'pending' to
-- 'active' — there's no separate resting "approved" state to migrate
-- through. See app/api/admin/contractors/[id]/route.js.

alter table contractors add column if not exists pass_id text;
alter table contractors add column if not exists document_type text;
alter table contractors add column if not exists freezone_pass_url text;
alter table contractors add column if not exists emirates_id_url text;
alter table contractors add column if not exists denial_reason text;
alter table contractors add column if not exists decided_at timestamptz;

alter table contractors drop constraint if exists contractors_status_check;
alter table contractors add constraint contractors_status_check
  check (status in ('pending', 'denied', 'active', 'inactive'));

alter table contractors drop constraint if exists contractors_document_type_check;
alter table contractors add constraint contractors_document_type_check
  check (document_type is null or document_type in ('freezone_pass', 'passport_emirates_id'));

-- Atomic short-ID generator — a sequence (not "count existing rows + 1")
-- so two registrations submitted at the same moment can never collide.
create sequence if not exists contractor_pass_seq;

create or replace function next_contractor_pass_id()
returns text
language sql
as $$
  select 'CP-' || extract(year from now())::text || '-' || lpad(nextval('contractor_pass_seq')::text, 4, '0');
$$;

-- Backfill any pre-existing contractors so every row has a pass ID, then
-- enforce uniqueness going forward.
update contractors set pass_id = next_contractor_pass_id() where pass_id is null;

create unique index if not exists contractors_pass_id_key on contractors (pass_id);

-- No new tables, so no new RLS setup needed — contractors already has RLS
-- enabled with no public policies; all access continues to go through
-- app/api/contractors and app/api/admin/contractors using the service
-- role key.
