-- Run this in the Supabase SQL editor for your EXISTING project.
-- New table only — doesn't touch any existing data, including the
-- separate `vehicle_requests` table (employee requests + coordinator
-- approval — a different workflow from this one).

create table if not exists vehicle_movements (
  id uuid primary key default gen_random_uuid(),
  facility text not null default 'harmony' check (facility in ('harmony', 'idl')),

  -- Vehicle TYPE (e.g. "Sedan"), matching lib/vehicles.js — this app
  -- tracks fleet availability at the vehicle-type level (same
  -- simplification already used by the vehicle_requests workflow), not
  -- individual physical units. The license plate is what actually
  -- identifies the specific vehicle for a given movement.
  vehicle text not null,
  license_plate text not null,

  driver_name text not null,
  destination text, -- customer / destination, optional

  checked_out_at timestamptz not null default now(),
  checked_out_by text, -- guard's email
  checkout_condition_notes text,
  checkout_photo_url text, -- private storage path (vehicle-movement-photos bucket)

  checked_in_at timestamptz, -- NULL = still checked out
  checked_in_by text,
  checkin_condition_notes text,
  checkin_photo_url text,
  incident_notes text,

  created_at timestamptz not null default now()
);

create index if not exists vehicle_movements_facility_idx on vehicle_movements(facility);
create index if not exists vehicle_movements_active_idx on vehicle_movements(facility, vehicle) where checked_in_at is null;
alter table vehicle_movements enable row level security;
