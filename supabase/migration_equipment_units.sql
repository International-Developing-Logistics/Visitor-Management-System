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

insert into equipment_units (id, name, type, facility) values
  ('pallet-jack-1', 'Pallet Jack #1', 'Pallet Jack', 'harmony'),
  ('forklift-1', 'Forklift #1', 'Forklift', 'harmony'),
  ('reach-truck-1', 'Reach Truck #1', 'Reach Truck', 'harmony')
on conflict (id) do nothing;
