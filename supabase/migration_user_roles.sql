-- Run this in the Supabase SQL editor for your EXISTING project.
-- New table only — doesn't touch any existing data or accounts. Every
-- existing login keeps working exactly as before (see note below on the
-- "no row = admin" default).

create table if not exists user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text, -- denormalized for readability in the Table Editor; not the source of truth
  role text not null check (role in ('admin', 'guard')),
  created_at timestamptz not null default now()
);

alter table user_roles enable row level security;

-- Each signed-in user can read only their OWN role row — nothing else.
-- Deliberately no insert/update/delete policy: assigning roles is done by
-- staff via the Table Editor (which uses elevated access), so the
-- browser-facing key stays strictly read-only and self-scoped here.
drop policy if exists "select own role" on user_roles;
create policy "select own role" on user_roles
  for select using (auth.uid() = user_id);

-- HOW TO MAKE SOMEONE A GUARD (restricted to /guard and /idl/guard only,
-- no /admin access):
-- 1. Create their login as usual: Authentication -> Users -> Add user.
-- 2. Copy their User UID from that list.
-- 3. Table Editor -> user_roles -> Insert row:
--      user_id = their UID, email = their email (optional, just for your
--      own reference), role = 'guard'
--
-- Any account with NO row in this table (i.e. everyone created before this
-- migration) is treated as a full admin — that's what preserves existing
-- staff access exactly as it was.
