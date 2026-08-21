alter table vehicle_requests add column if not exists needed_from timestamptz;
alter table vehicle_requests add column if not exists needed_until timestamptz;

alter table equipment_requests add column if not exists needed_from timestamptz;
alter table equipment_requests add column if not exists needed_until timestamptz;
