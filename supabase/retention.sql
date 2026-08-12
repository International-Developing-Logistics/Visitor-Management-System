-- OPTIONAL. Run this only if you want old visitor RECORDS to be automatically
-- deleted after a set number of days. Not required to launch — decide your
-- retention period first (check with whoever owns privacy/compliance at your
-- company), then adjust `interval '90 days'` below to match before running.
--
-- Note on files: this deletes the DATABASE ROWS. Supabase Storage doesn't
-- reliably support deleting the underlying photo/signature files from plain
-- SQL — that needs the Storage API. The simplest way to also purge old files
-- is a small scheduled script (a Vercel Cron Job hitting a
-- /api/admin/purge-expired route, or a Supabase Edge Function on a cron
-- trigger) that lists visitors past the retention window, calls
-- supabase.storage.from(bucket).remove([path]) for each, then deletes the
-- rows. Ask if you'd like that route built — it's a straightforward addition.

create extension if not exists pg_cron;

create or replace function delete_expired_visitor_records() returns void as $$
begin
  delete from visitors where created_at < now() - interval '90 days';
end;
$$ language plpgsql security definer;

-- Runs daily at 03:00 UTC. Adjust the schedule, or drop this line and call
-- select delete_expired_visitor_records(); manually whenever you like.
select cron.schedule('delete-expired-visitor-records', '0 3 * * *', 'select delete_expired_visitor_records();');

