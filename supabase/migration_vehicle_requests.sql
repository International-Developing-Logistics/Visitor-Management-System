create table if not exists vehicle_requests (
  id uuid primary key default gen_random_uuid(),
  facility text not null default 'harmony' check (facility in ('harmony', 'idl')),
  employee_name text not null,
  vehicle text not null,
  destination text not null,
  estimated_time text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approval_token text unique not null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists vehicle_requests_facility_idx on vehicle_requests(facility);
alter table vehicle_requests enable row level security;
