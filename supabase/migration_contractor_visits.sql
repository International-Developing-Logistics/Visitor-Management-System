create table if not exists contractor_visits (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references contractors (id) on delete cascade,
  checked_in_at timestamptz not null default now(),
  checked_in_by text,
  checked_out_at timestamptz,
  checked_out_by text,
  created_at timestamptz not null default now()
);

create index if not exists contractor_visits_open_idx
  on contractor_visits (contractor_id)
  where checked_out_at is null;

create index if not exists contractor_visits_contractor_id_checked_in_at_idx
  on contractor_visits (contractor_id, checked_in_at desc);

alter table contractor_visits enable row level security;
