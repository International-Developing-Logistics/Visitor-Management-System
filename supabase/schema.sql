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
  email text not null,
  phone text,
  company text,
  purpose text not null default '',
  host_id uuid references hosts(id),
  photo_url text, -- private storage PATH (e.g. "<uuid>.jpg"), not a public URL
  signature_url text, -- private storage PATH, signed on demand server-side
  nda_signed_at timestamptz,
  visit_type text not null default 'walkin' check (visit_type in ('walkin', 'prereg')),
  status text not null default 'checked_in'
    check (status in ('invited', 'pre_registered', 'checked_in', 'checked_out')),
  checkin_token text unique,
  notes text,
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

-- Seed a couple of hosts to get started — edit these, or manage hosts
-- from the Supabase Table Editor.
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
