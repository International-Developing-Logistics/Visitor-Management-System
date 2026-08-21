create table if not exists equipment_requests (
  id uuid primary key default gen_random_uuid(),
  facility text not null default 'harmony' check (facility in ('harmony', 'idl')),
  employee_name text not null,
  equipment text not null,
  location text,
  estimated_time text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists equipment_requests_facility_idx on equipment_requests(facility);
alter table equipment_requests enable row level security;
