-- Run this in the Supabase SQL editor (Project -> SQL Editor -> New query).

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
  email text, -- optional: visitors can check in without an email
  phone text,
  company text,
  purpose text not null default '',
  host_id uuid references hosts(id),
  photo_url text, -- private storage PATH (e.g. "<uuid>.jpg"), not a public URL
  signature_url text, -- private storage PATH, signed on demand server-side
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
  additional_visitor_count integer not null default 0, -- group check-in: guests beyond the primary visitor
  additional_visitor_names text, -- optional free-text names of the group
  proposed_time_slots jsonb, -- JSON array of ISO timestamps the host offers
  selected_time_slot timestamptz, -- the one the guest picked, if any
  proposed_alternative_time timestamptz, -- guest's own suggested time, if none of the offered slots worked
  facility text not null default 'harmony' check (facility in ('harmony', 'idl')),
  created_at timestamptz not null default now(),
  checked_in_at timestamptz,
  checked_out_at timestamptz
);

create index if not exists visitors_host_id_idx on visitors(host_id);
create index if not exists visitors_checkin_token_idx on visitors(checkin_token);
create index if not exists visitors_status_idx on visitors(status);

-- Row Level Security: the app only ever talks to Supabase through the
-- server-side service role key (see lib/supabaseClient.js -> getSupabaseAdmin),
-- which bypasses RLS. Enabling RLS with no public policies means the anon
-- key (used nowhere in this app, but shipped in the client bundle) can't
-- read or write anything directly.
alter table hosts enable row level security;
alter table visitors enable row level security;

-- Seeds your actual current host list, so if this project ever needs to be
-- recreated (new Supabase project, disaster recovery, etc.) you don't have
-- to re-enter everyone by hand in /admin/hosts. Keep this updated when your
-- host list changes significantly, or just manage day-to-day changes from
-- /admin/hosts directly — this file only matters if you're rebuilding from
-- scratch.
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

-- Contractor pass system — separate from one-off visitors, since
-- contractors need multi-visit, time-bounded access.
create table if not exists contractors (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  resident_id text,
  company text,
  passport_url text, -- private storage path (contractor-documents bucket)
  estimated_duration text,
  status text not null default 'pending' check (status in ('pending', 'active', 'inactive')),
  pass_token text unique not null,
  validity_start timestamptz,
  validity_end timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists contractors_pass_token_idx on contractors(pass_token);
alter table contractors enable row level security;

-- Security guard vehicle/visitor log — separate from visitors, since this
-- tracks physical gate activity (who came through, in what vehicle) rather
-- than a hosted visit.
create table if not exists guard_logs (
  id uuid primary key default gen_random_uuid(),
  facility text not null default 'harmony' check (facility in ('harmony', 'idl')),
  visitor_name text not null,
  phone text,
  company text,
  vehicle_plate_photo_url text, -- private storage path (vehicle-plates bucket)
  car_type text check (car_type in ('sedan', 'suv', 'van', 'semi-truck')),
  logged_by_email text,
  checked_in_at timestamptz not null default now(),
  checked_out_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists guard_logs_facility_idx on guard_logs(facility);
alter table guard_logs enable row level security;

-- Role-based access: any account with no row here defaults to 'admin' (see
-- lib/verifyAdmin.js). Only explicitly add a row here to restrict someone
-- to 'guard' (guard stations only, no /admin access).
create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null check (role in ('admin', 'guard')),
  created_at timestamptz not null default now()
);

alter table user_roles enable row level security;
create policy "select own role" on user_roles
  for select using (auth.uid() = user_id);

-- Employee vehicle requests, reviewed by transport coordinators (via email
-- approve/deny links, same pattern as gate approvals, or from /admin).
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
