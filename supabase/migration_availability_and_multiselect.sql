alter table vehicle_requests add column if not exists returned_at timestamptz;
alter table equipment_requests add column if not exists equipment_items text[];
alter table equipment_requests add column if not exists external_rental_request text;
alter table equipment_requests add column if not exists returned_at timestamptz;
alter table equipment_requests alter column equipment drop not null;
