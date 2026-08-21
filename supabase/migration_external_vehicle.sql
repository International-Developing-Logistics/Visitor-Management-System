-- Run this in the Supabase SQL editor for your EXISTING project.
-- Additive + relaxes two constraints — no existing data is touched.

alter table vehicle_requests add column if not exists is_external boolean not null default false;
alter table vehicle_requests add column if not exists customer_name text;

-- An external vehicle request has no fleet vehicle and no requesting
-- employee in the usual sense — both become optional. Existing rows are
-- unaffected (they already have real values in these columns).
alter table vehicle_requests alter column vehicle drop not null;
alter table vehicle_requests alter column employee_name drop not null;
