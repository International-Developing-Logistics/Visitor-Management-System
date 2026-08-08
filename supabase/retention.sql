create extension if not exists pg_cron;

create or replace function delete_expired_visitor_records() returns void as $$
begin
  delete from visitors where created_at < now() - interval '90 days';
end;
$$ language plpgsql security definer;

select cron.schedule('delete-expired-visitor-records', '0 3 * * *', 'select delete_expired_visitor_records();');

