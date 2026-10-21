-- Run this in the Supabase SQL editor for your EXISTING project.
-- New table only - doesn't touch `equipment_requests` (the old
-- employee-request/admin-approval workflow, now retired in favor of this
-- QR-scan checkout/return log - see lib/equipmentUnits.js).
--
-- Unlike vehicle_movements (which tracks a shared VEHICLE TYPE, since any
-- sedan will do), this tracks an individual PHYSICAL UNIT - each one has
-- its own QR code (see lib/equipmentUnits.js), so `unit_id` identifies the
-- exact forklift/pallet jack/etc., not just its type.
create table if not exists equipment_movements (
  id uuid primary key default gen_random_uuid(),
  facility text not null default 'harmony' check (facility in ('harmony', 'idl')),

  -- Matches an entry in lib/equipmentUnits.js at the time of checkout.
  -- unit_name/equipment_type are a snapshot (not a live join) so history
  -- still reads correctly even if that list is edited or reordered later.
  unit_id text not null,
  unit_name text not null,
  equipment_type text not null,

  user_name text not null, -- company or employee name, typed at checkout

  checked_out_at timestamptz not null default now(),
  -- checked_in_at NULL = still checked out. A unit with an open (NULL)
  -- row here is what the checkout form (app/api/equipment-log POST)
  -- blocks a second checkout against.
  checked_in_at timestamptz,

  -- Captured at return, not at checkout - see app/api/equipment-log/[id]/checkin.
  hour_meter_photo_url text, -- private storage path (equipment-log-photos bucket)
  damaged boolean not null default false,
  damage_photo_url text,
  damage_notes text,

  created_at timestamptz not null default now()
);

create index if not exists equipment_movements_facility_idx on equipment_movements(facility);
create index if not exists equipment_movements_active_idx on equipment_movements(unit_id) where checked_in_at is null;
alter table equipment_movements enable row level security;

-- Manual step (this migration doesn't create it): add a PRIVATE storage
-- bucket named "equipment-log-photos" in Supabase Storage, same way the
-- existing vehicle-plates / vehicle-movement-photos buckets were created -
-- see HANDOVER.md §6.
