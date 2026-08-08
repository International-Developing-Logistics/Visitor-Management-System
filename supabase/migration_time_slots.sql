alter table visitors add column if not exists proposed_time_slots jsonb;
alter table visitors add column if not exists selected_time_slot timestamptz;