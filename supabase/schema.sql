create extension if not exists "pgcrypto";

create table if not exists hosts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  department text,
  created_at timestamptz not null default now()
);

create table if not exists visitors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null default '',
  email text, -- visitors can check in without an email
  phone text,
  company text,
  purpose text not null default '',
  host_id uuid references hosts(id),
  photo_url text,
  signature_url text,
  nda_signed_at timestamptz,
  visit_type text not null default 'walkin' check (visit_type in ('walkin', 'prereg')),
  status text not null default 'checked_in'
    check (status in (
      'requested', 'invited', 'pre_registered', 'checked_in', 'checked_out',
      'gate_pending', 'gate_approved', 'gate_denied'
    )),
  checkin_token text unique,
  approval_token text unique, -- for gate walk-in email approve/deny links
  notes text,
  additional_visitor_count integer not null default 0, -- group check-in
  additional_visitor_names text, 
  proposed_time_slots jsonb, 
  selected_time_slot timestamptz,
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_out_at timestamptz
);

create index if not exists visitors_host_id_idx on visitors(host_id);
create index if not exists visitors_checkin_token_idx on visitors(checkin_token);
create index if not exists visitors_status_idx on visitors(status);

alter table hosts enable row level security;
alter table visitors enable row level security;

insert into hosts (name, email, department) values
  ('Ajeethan Selvaratnam', 'operations@idllogistics.ae', 'Operations Department'),
  ('Crisylle Tablit', 'ops.support@idllogistics.ae', 'Operations Department'),
  ('Dileep Kumar', 'cfo@idllogistics.ae', 'Finance Department'),
  ('Mohamed Hamdhan', 'supply.chain@idllogistics.ae', 'Supply Chain Department'),
  ('Mohammad Salimi', 'mohammad.s@idllogistics.ae', 'Director''s Office'),
  ('Santhosh Shetty', 'finance@idllogistics.ae', 'Finance Department'),
  ('Arun Bote', 'accounts.sr@idllogistics.ae', 'Accounts Department'),
  ('Ayman', 'crm1@harmonydwc.ae', 'IT Department'),
  ('Mhai Labajanan', 'support@idllogistics.ae', 'Operations Department'),
  ('Roshan Shinde', 'roshan@idllogistics.ae', 'Human Resources Department')
on conflict do nothing;

-- Contractor pass system 
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
