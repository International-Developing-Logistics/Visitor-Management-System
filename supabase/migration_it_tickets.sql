-- Run this in the Supabase SQL editor for your EXISTING project.
-- New table only - doesn't touch any existing data or accounts.
--
-- Unlike feature_recommendations, IT Tickets capture who submitted them
-- (submitter_name/email) since a real IT issue usually needs follow-up
-- with the reporter - that's a deliberate difference from the anonymous
-- Feature Requests table, not an oversight.

create table if not exists it_tickets (
  id uuid primary key,
  facility text not null default 'harmony',
  submitter_name text not null,
  submitter_email text not null,
  description text not null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'urgent')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table it_tickets enable row level security;

-- No public policies, same lockdown as every other table - all access
-- goes through app/api/it-tickets and app/api/admin/it-tickets using the
-- Supabase service role key.
