-- Run this in the Supabase SQL editor for your EXISTING project.
-- New table only - part of the Gate Check Form integration (see
-- CLIENT_PORTAL_AND_GATE_CHECK_DESIGN.md Part A). Replaces the standalone
-- Container_Gate_Check_Form.html, which saved everything to the browser's
-- own localStorage/IndexedDB with no server involved at all.
--
-- A handful of fields are pulled out as real columns because the admin
-- list needs to filter/sort on them; every other field from the form's 11
-- sections lives in the `fields` jsonb blob, keyed the same way the form
-- itself keys them (see components/GateCheckForm.jsx SECTIONS).
create table if not exists gate_check_forms (
  id uuid primary key default gen_random_uuid(),
  facility text not null default 'harmony' check (facility in ('harmony', 'idl')),
  form_no text not null,

  container_no text,
  truck_plate text,
  driver_name text,
  decision text check (decision in ('Accept', 'Hold', 'Reject') or decision is null),
  check_date date,

  fields jsonb not null default '{}'::jsonb,
  -- { officer: {name, time, photo_path}, supervisor: {...}, driver: {...},
  --   receiver: {...}, receipt: {name, photo_path} }
  signatures jsonb not null default '{}'::jsonb,
  stamp_photo_path text,
  -- [{ field, label, file_name, taken_at, taken_source, gps, photo_path }, ...]
  -- for the 7 optional photo-appendix capture slots
  photos jsonb not null default '[]'::jsonb,

  submitted_by uuid references auth.users(id),
  submitted_by_email text,
  created_at timestamptz not null default now()
);

create index if not exists gate_check_forms_facility_idx on gate_check_forms(facility);
create index if not exists gate_check_forms_created_idx on gate_check_forms(created_at desc);
alter table gate_check_forms enable row level security;
-- No public policies - all access via the service-role key in API routes,
-- same lockdown as every other table in this app.

-- Manual step (this migration doesn't create it): add a PRIVATE storage
-- bucket named "gate-check-forms" in Supabase Storage, same way the
-- existing equipment-log-photos bucket was created - see HANDOVER.md §6.
