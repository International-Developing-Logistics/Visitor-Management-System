-- Run this in the Supabase SQL editor for your EXISTING project.
-- New tables only - part of the Client Portal (see
-- CLIENT_PORTAL_AND_GATE_CHECK_DESIGN.md Part B).
--
-- Deliberately separate from user_roles: a client login must NEVER be
-- confused with an internal admin/guard/staff login, and must NEVER fall
-- into user_roles' "no row = admin" default. lib/verifyClient.js resolves
-- callers against client_accounts ONLY, with no default-grant fallback -
-- no match means unauthorized, full stop. lib/verifyAdmin.js also checks
-- client_accounts and refuses staff access to any account that has a row
-- there, regardless of what's (or isn't) in user_roles - defense in depth
-- against a client ever being treated as staff.

-- The client organization/customer itself.
create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  facility text check (facility in ('harmony', 'idl')), -- optional, if a client is tied to one facility
  created_at timestamptz not null default now()
);

-- Login accounts. One client can have several logins (client_id isn't
-- unique); one login belongs to exactly one client (user_id is the
-- primary key, same shape as user_roles).
create table if not exists client_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- Files made visible to a client. Storage lives in a PRIVATE bucket
-- (never public), path-namespaced per client so a leaked/guessed path
-- alone can't reach another client's file:
-- client-files/<client_id>/<uuid>-<filename>
create table if not exists client_files (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clients(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  downloadable boolean not null default true, -- admin can mark a file view-only vs. downloadable; enforced server-side in /api/client/files/[fileId]/download
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

create index if not exists client_accounts_client_idx on client_accounts(client_id);
create index if not exists client_files_client_idx on client_files(client_id);

alter table clients enable row level security;
alter table client_accounts enable row level security;
alter table client_files enable row level security;

-- Every admin-side operation on these three tables goes through the
-- service-role key in app/api/admin/clients/**, so none of them get a
-- general public policy. client_accounts is the one exception: a signed-in
-- client needs to read their OWN row client-side so components/ClientGuard.jsx
-- can resolve "is this account a client, and which one" before it ever
-- calls an API route - same narrow self-row-only pattern already used for
-- user_roles (see migration_user_roles.sql). This does not expose
-- client_id for any OTHER account, and clients/client_files stay fully
-- locked down (no browser-facing access at all, not even self-scoped).
drop policy if exists "select own client account" on client_accounts;
create policy "select own client account" on client_accounts
  for select using (auth.uid() = user_id);

-- Manual step (this migration doesn't create it): add a PRIVATE storage
-- bucket named "client-files" in Supabase Storage, same way the existing
-- gate-check-forms / equipment-log-photos buckets were created - see
-- HANDOVER.md §6.
