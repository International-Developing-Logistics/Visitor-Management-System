-- Run this in the Supabase SQL editor for your EXISTING project.
-- Purely additive: loosens the existing role check constraint to also
-- allow 'staff'. Touches no existing rows, no existing account's access
-- changes as a result of running this.

alter table user_roles drop constraint if exists user_roles_role_check;
alter table user_roles add constraint user_roles_role_check
  check (role in ('admin', 'guard', 'staff'));

-- HOW TO MAKE SOMEONE STAFF (a narrower tier than admin/guard — access to
-- the Staff Hub, Vehicle Request, Equipment Request, Request-Invite, and
-- the Email Writer only; no /admin or /guard access):
-- 1. Create their login as usual: Authentication -> Users -> Add user.
-- 2. Copy their User UID from that list.
-- 3. Table Editor -> user_roles -> Insert row:
--      user_id = their UID, email = their email (optional, just for your
--      own reference), role = 'staff'
--
-- As before, any account with NO row in user_roles is still treated as a
-- full admin — that default is unchanged by this migration.
