-- Run this in the Supabase SQL editor for your EXISTING project.
-- New table only - makes the physical equipment list that used to live in
-- lib/equipmentUnits.js admin-manageable from the dashboard (Admin >
-- Equipment > Print QR Labels) instead of requiring a code edit and
-- redeploy every time a unit is added, renamed, or retired.
--
-- Seeded below with the three units that were previously hardcoded in
-- lib/equipmentUnits.js, using the SAME `id` values for each - that id is
-- permanently baked into every QR code already printed and stuck on a
-- physical piece of equipment, so changing it here would orphan those
-- labels. New units added from the dashboard get their id generated from
-- their name.
create table if not exists equipment_units (
  id text primary key, -- what the printed QR code encodes, as /equipment-log/<id> - treat as permanent once a label is printed
  name text not null,
  type text not null,
  facility text not null default 'harmony' check (facility in ('harmony', 'idl')),
  active boolean not null default true, -- false = retired: hidden from the checkout/print list, but kept so an old sticker still resolves to a clear "no longer in service" message instead of a 404
  created_at timestamptz not null default now()
);

create index if not exists equipment_units_facility_idx on equipment_units(facility);
alter table equipment_units enable row level security;

-- Supabase stops auto-granting Data API access to new "public" tables as
-- of Oct 30, 2026 - without this, every call through getSupabaseAdmin()
-- (which goes over the Data API, even with the service role key) would
-- get a "permission denied" error. anon/authenticated are intentionally
-- left out: this app never queries tables directly with those keys (only
-- for supabase.auth.* sign-in), and RLS has no policy admitting them
-- anyway, so granting them here would do nothing but widen the surface.
grant select, insert, update, delete on public.equipment_units to service_role;

insert into equipment_units (id, name, type, facility) values
  ('pallet-jack-1', 'Pallet Jack #1', 'Pallet Jack', 'harmony'),
  ('forklift-1', 'Forklift #1', 'Forklift', 'harmony'),
  ('reach-truck-1', 'Reach Truck #1', 'Reach Truck', 'harmony')
on conflict (id) do nothing;
