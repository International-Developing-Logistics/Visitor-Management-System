-- Run this in the Supabase SQL editor for your EXISTING project.
-- New table only — doesn't touch any existing data.

create table if not exists guard_logs (
  id uuid primary key default gen_random_uuid(),
  facility text not null default 'harmony' check (facility in ('harmony', 'idl')),
  visitor_name text not null,
  phone text,
  company text,
  vehicle_plate_photo_url text, -- private storage path (vehicle-plates bucket)
  car_type text check (car_type in ('sedan', 'suv', 'van', 'semi-truck')),
  logged_by_email text, -- which guard account logged this, for accountability
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists guard_logs_facility_idx on guard_logs(facility);
alter table guard_logs enable row level security;
