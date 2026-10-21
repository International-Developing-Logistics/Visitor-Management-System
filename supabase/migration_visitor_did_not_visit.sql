-- Run this in the Supabase SQL editor for your EXISTING project.
-- Purely additive: widens the existing visitors.status check constraint to
-- also allow 'did_not_visit', and (optionally) schedules the daily cleanup
-- that applies it automatically. See VISITOR_FEATURES_DESIGN.md Part 1.

alter table visitors drop constraint if exists visitors_status_check;
alter table visitors add constraint visitors_status_check
  check (status in (
    'requested', 'invited', 'pre_registered', 'checked_in', 'checked_out',
    'gate_pending', 'gate_approved', 'gate_denied', 'did_not_visit'
  ));

-- Two separate rules, matching the two different ways a pre-registration
-- can go stale (see lib/visitorLifecycle.js, which has the equivalent
-- logic in JS for the manual "Run now" admin route - keep both in sync by
-- hand if these grace periods ever change):
--
-- 1. A visitor with a CONCRETE expected date (selected_time_slot or
--    proposed_alternative_time) who never checked in gets marked
--    'did_not_visit' once their expected Dubai calendar day has fully
--    ended, plus one more full day of grace - i.e. two calendar days
--    after the expected date, at 00:00 Dubai time.
-- 2. An 'invited' row (a staff invite link nobody ever completed at all -
--    completing it always moves status to 'pre_registered', regardless
--    of whether a time was picked) gets DELETED outright, not marked,
--    once it's a week old. These were never a real visit - just an
--    unanswered invite - so there's nothing worth keeping around.
create or replace function mark_overdue_preregistrations_as_did_not_visit() returns void as $$
begin
  -- date_trunc('day', ... at time zone 'Asia/Dubai') gives Dubai local
  -- midnight of the expected day as a naive timestamp; + 2 days moves
  -- that to midnight two days later (the expected day fully elapsed,
  -- plus one more full day of grace); the trailing "at time zone" then
  -- converts that Dubai wall-clock instant back to a real timestamptz
  -- comparable with now().
  update visitors
  set status = 'did_not_visit'
  where status in ('invited', 'pre_registered')
    and checked_in_at is null
    and coalesce(selected_time_slot, proposed_alternative_time) is not null
    and now() >= (
      date_trunc('day', coalesce(selected_time_slot, proposed_alternative_time) at time zone 'Asia/Dubai')
      + interval '2 days'
    ) at time zone 'Asia/Dubai';
end;
$$ language plpgsql security definer;

create or replace function delete_stale_unanswered_invites() returns void as $$
begin
  delete from visitors
  where status = 'invited'
    and created_at < now() - interval '7 days';
end;
$$ language plpgsql security definer;

-- OPTIONAL - requires the pg_cron extension to be available/enabled on
-- your Supabase project (Database -> Extensions). If you'd rather not
-- enable it right now, skip the three lines below: the admin Visitors
-- page has a "Run visitor housekeeping now" button that calls the exact
-- same two functions on demand (POST /api/admin/visitors/expire-overdue),
-- so nothing below is required for the feature to work, just for it to
-- run completely unattended.
create extension if not exists pg_cron;
select cron.schedule('mark-overdue-preregistrations', '15 20 * * *', 'select mark_overdue_preregistrations_as_did_not_visit();');
select cron.schedule('delete-stale-unanswered-invites', '20 20 * * *', 'select delete_stale_unanswered_invites();');
