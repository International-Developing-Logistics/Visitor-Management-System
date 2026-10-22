-- Run this in the Supabase SQL editor for your EXISTING project.
--
-- If you already ran an earlier version of this file, your table exists
-- without the `notes` column (that's why the last run errored with
-- "column notes does not exist" - `create table if not exists` is a
-- no-op once the table's there, so it never picked up the new column on
-- its own). The `alter table ... add column if not exists` line below
-- fixes that - safe to run this whole file again from scratch either way.
--
-- Seeded below with the real EHS forklift/equipment list (20 units) -
-- `id` is lowercased from each unit's existing Machine Id (RT-01, FL-01,
-- PPT-01, etc.) since that's already a real, unique code used on the
-- shop floor; it's what the printed QR code encodes, as
-- /equipment-log/<id>, so once a label is printed it should be treated as
-- permanent. `notes` carries brand/model/year/warehouse context from the
-- source sheet for reference - optional, shown read-only in the admin
-- list.
--
-- Two fixes made vs. the raw source sheet, confirmed with the user:
--   - The Karcher/Aisle Master reach truck (serial 84411) had Machine Id
--     "RT-04" in the sheet, duplicating the Still FM-X14 unit below it -
--     renumbered to RT-05 here since RT-01..RT-04 were already taken.
--   - Two units (PPT-10, FL-05) were tagged warehouse "AMDC" rather than
--     "IDL" in the sheet; the app's facility field only distinguishes
--     Harmony vs. IDL (it drives branding/routing elsewhere), so both are
--     filed under 'idl' with "AMDC warehouse" noted instead.
-- "Air Compressor" and "Welding Machine" (listed on a separate sheet with
-- no brand/ID/warehouse info) were intentionally left out - not QR-
-- tracked gear.
create table if not exists equipment_units (
  id text primary key, -- what the printed QR code encodes, as /equipment-log/<id> - treat as permanent once a label is printed
  name text not null,
  type text not null,
  facility text not null default 'harmony' check (facility in ('harmony', 'idl')),
  active boolean not null default true, -- false = retired: hidden from the checkout/print list, but kept so an old sticker still resolves to a clear "no longer in service" message instead of a 404
  created_at timestamptz not null default now()
);

-- Backfills `notes` onto a table created by an earlier run of this file,
-- before this column existed.
alter table equipment_units add column if not exists notes text; -- optional free-text context (brand/model/year/warehouse) - not used by any logic, just shown in the admin list

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

-- Clears out the 3 placeholder rows from an earlier run of this file,
-- before the real inventory (below) replaced them. No-op if they were
-- never inserted.
delete from equipment_units where id in ('pallet-jack-1', 'forklift-1', 'reach-truck-1');

insert into equipment_units (id, name, type, facility, notes) values
  ('rt-01', 'Reach Truck RT-01', 'Reach Truck', 'idl', 'Toyota · Model 1065 · 2022'),
  ('rt-02', 'Reach Truck RT-02', 'Reach Truck', 'idl', 'Still FM-X14(S), 1,400kg capacity · 2022'),
  ('rt-03', 'Reach Truck RT-03', 'Reach Truck', 'idl', 'Still FM-X14(S), 1,400kg capacity · 2022'),
  ('fl-01', 'Forklift FL-01', 'Forklift', 'idl', 'Toyota 8FBN25, electric · 2019'),
  ('ppt-01', 'Electric Jack PPT-01', 'Electric Jack', 'idl', 'Still EXH S20, 2,000kg capacity · 2022'),
  ('ppt-02', 'Electric Jack PPT-02', 'Electric Jack', 'idl', 'Still EXH SF20, 2,000kg capacity · 2022'),
  ('ppt-03', 'Electric Jack PPT-03', 'Electric Jack', 'idl', 'Still EXH SF20, 2,000kg capacity · 2022'),
  ('ppt-04', 'Electric Jack PPT-04', 'Electric Jack', 'idl', 'Still EXH SF20, 2,000kg capacity · 2022'),
  ('ppt-05', 'Electric Jack PPT-05', 'Electric Jack', 'idl', 'Still EXH SF20, 2,000kg capacity · 2018'),
  ('ppt-06', 'Electric Jack PPT-06', 'Electric Jack', 'idl', 'Still CBD 30 · 2018'),
  ('rt-04', 'Reach Truck RT-04', 'Reach Truck', 'idl', 'Still FM-X14, rider-seated · 2018'),
  ('fl-02', 'Forklift FL-02', 'Forklift', 'idl', 'Toyota FSV 4.7 E62, electric · 2022'),
  ('ppt-07', 'Electric Jack PPT-07', 'Electric Jack', 'idl', 'Still EXU SF20, electric low lift · 2018'),
  ('ppt-08', 'Electric Jack PPT-08', 'Electric Jack', 'idl', 'Toyota BT Levio LPE200B, 2.0 ton · 2022'),
  ('ppt-09', 'Electric Jack PPT-09', 'Electric Jack', 'idl', 'Toyota LPE200B · 2022'),
  ('fl-03', 'Forklift FL-03', 'Forklift', 'idl', 'Toyota 62-8FD25, diesel'),
  ('fl-04', 'Forklift FL-04', 'Forklift', 'idl', 'Toyota 8FDU25, diesel'),
  ('ppt-10', 'Electric Jack PPT-10', 'Electric Jack', 'idl', 'Still EXH SF20 · 2022 · AMDC warehouse'),
  ('fl-05', 'Forklift FL-05', 'Forklift', 'idl', 'Caterpillar DP20NT, diesel · AMDC warehouse'),
  ('rt-05', 'Reach Truck RT-05', 'Reach Truck', 'idl', 'Karcher Aisle Master, serial 84411')
on conflict (id) do nothing;
