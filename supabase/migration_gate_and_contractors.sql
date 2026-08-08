do $$
declare
  con record;
begin
  for con in
    select conname from pg_constraint
    where conrelid = 'visitors'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%status%'
  loop
    execute format('alter table visitors drop constraint %I', con.conname);
  end loop;
end $$;

alter table visitors add constraint visitors_status_check
  check (status in (
    'requested', 'invited', 'pre_registered', 'checked_in', 'checked_out',
    'gate_pending', 'gate_approved', 'gate_denied'
  ));

alter table visitors add column if not exists approval_token text unique;

create table if not exists contractors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  resident_id text,
  passport_url text,
  estimated_duration text,
  status text not null default 'pending' check (status in ('pending', 'active', 'inactive')),
  pass_token text unique not null,
  validity_start timestamptz,
  validity_end timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contractors_pass_token_idx on contractors(pass_token);
alter table contractors enable row level security;
