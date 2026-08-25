-- Run this in the Supabase SQL editor for your EXISTING project.
-- New table only — doesn't touch any existing data or accounts.
--
-- Deliberately anonymous: there is no submitter/employee column here at
-- all, not even a hidden one. The API route (app/api/recommendations)
-- checks that the caller is a signed-in admin/staff/guard account before
-- accepting a submission, but never writes that identity into this table.

create table if not exists feature_recommendations (
  id uuid primary key,
  description text not null,
  status text not null default 'new' check (status in ('new', 'planned', 'done', 'declined')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table feature_recommendations enable row level security;

-- No public policies, same lockdown as every other table — all access
-- goes through app/api/recommendations and app/api/admin/recommendations
-- using the Supabase service role key.
