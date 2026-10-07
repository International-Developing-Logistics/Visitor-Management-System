# Design: Automatic Pre-registration Tracking, Admin-Created Visitors, Returning-Visitor Recognition

Status: **proposal, not yet built** - written for review before implementation, same convention as the rest of this project's non-trivial changes.

This covers three related but separable pieces of work, all inside the existing `visitors` table and check-in workflow rather than new subsystems:

1. Automatically mark overdue pre-registrations as **Did Not Visit**, with admin override.
2. Let an admin create a fully-formed visitor record directly from the dashboard (no invite link round-trip).
3. Recognize a returning visitor at check-in by phone number and let them reuse their last details instead of retyping everything.

All three stay inside the current one-row-per-visit `visitors` table and the existing `requireAdmin`/`requireAdminOrGuard` role model - no new auth concepts, no new top-level nav area (the UI lands on the existing Visitors page and the two public check-in forms).

---

## Part 1 - Automatic pre-registration tracking ("Did Not Visit")

### What "expected visit date" already means in this schema

There's no separate "expected date" column to add - it already exists, just split across two nullable columns depending on how the pre-registration was made:

- `selected_time_slot` - the guest picked one of the specific times a host offered (via `/preregister`'s `proposed_time_slots`).
- `proposed_alternative_time` - the guest typed their own time instead (open self-pre-registration, or a staff invite the guest didn't like the offered slots for).

A visitor's "expected date" is `coalesce(selected_time_slot, proposed_alternative_time)`. If BOTH are null (e.g. a self-service pre-registration where the guest skipped picking a time, or a staff invite the guest never responded to at all), there is no known date to measure against, so nothing below can apply to that row - it just stays `invited`/`pre_registered` until an admin sets a meeting time or acts on it manually. This already shows as "Expected" on the admin Visitors page today, so nothing is hidden.

### The rule

A visitor in status `invited` or `pre_registered`, with `checked_in_at is null`, becomes **`did_not_visit`** once the Dubai calendar date has moved past the Dubai calendar date of their expected time - i.e. they get the *entire* expected day, not just the specific time slot, matching "by the end of the expected date" literally. Dubai is a fixed +4:00 offset (see `lib/timezone.js`), so this is computed the same way server-side.

**Open question (see questions at the end): should `invited` rows with no `selected_time_slot`/`proposed_alternative_time` at all, but with `proposed_time_slots` offered and never answered, eventually expire too** (using the *last* offered slot as a fallback deadline)? Default below: no - only rows with a concrete date expire automatically; an all-offered-none-picked invite needs a human to decide it's gone cold.

### How the transition actually runs

This app has no existing scheduler/cron infrastructure in Vercel (no `vercel.json`), but it already has exactly this shape of problem solved once: `supabase/retention.sql` uses Postgres's `pg_cron` extension for the (optional) old-record purge job. I'd follow the same pattern rather than introducing a new kind of infrastructure:

```sql
create or replace function mark_overdue_preregistrations_as_did_not_visit() returns void as $$
begin
  update visitors
  set status = 'did_not_visit'
  where status in ('invited', 'pre_registered')
    and checked_in_at is null
    and coalesce(selected_time_slot, proposed_alternative_time) is not null
    and (coalesce(selected_time_slot, proposed_alternative_time) at time zone 'Asia/Dubai')::date
        < (now() at time zone 'Asia/Dubai')::date;
end;
$$ language plpgsql security definer;

select cron.schedule('mark-overdue-preregistrations', '15 20 * * *', -- ~00:15 Dubai time, daily
  'select mark_overdue_preregistrations_as_did_not_visit();');
```

Because `pg_cron` needs to be available/enabled on the Supabase project (it's the same prerequisite `retention.sql` already calls out, and you may not have turned it on), I'd also expose the exact same SQL logic as a plain admin-callable route, so this works even if `pg_cron` isn't available, and so there's a manual "Run now" for testing or for wiring into an external scheduler later if you ever add one:

- `POST /api/admin/visitors/expire-overdue` (`requireAdmin`) - runs the equivalent update via Supabase, returns how many rows it changed. A small "Check for overdue pre-registrations" button on the admin Visitors page calls this on demand; the SQL function above (if you enable `pg_cron`) means you never have to remember to click it.

### Admin visibility and override

- "Did Not Visit" joins the Visitors page's existing **Completed** tab (`["checked_out", "gate_denied", "did_not_visit"]`) - a visit that's over, just with a different outcome than normal.
- New badge: `.badge.did_not_visit` (reuses the `gate_denied` danger-red tone - both mean "this visit didn't happen").
- Row actions: a visitor marked `did_not_visit` still shows **Check in** (for a legitimately late arrival - overrides the mark) and a new **Restore to Expected** button (puts them back to `invited`/`pre_registered`, for a wrong auto-mark or a reschedule). Both are plain `PATCH /api/admin/visitors/[id]` calls with `{ status: ... }` - the existing route already accepts a `status` field in principle, but the handler needs a small whitelist so admins can only set it to one of a safe set of values (not e.g. `gate_approved` for a visitor who was never at a gate) rather than accepting any string.

---

## Part 2 - Admin-created visitors

### What's missing today

`/preregister` (staff-only, already exists) creates a *stub* row from just an email and sends a check-in link - the guest still fills in their own name/phone/company themselves later. What's being asked for here is different: an admin who already knows everything about the visitor (on the phone with them, or entering a walk-in's details after the fact) enters it all **once**, directly, with no link/token round-trip at all.

### Approach: shared validation, new admin-only route

To literally satisfy "apply the same validation and workflow rules used for visitor self-registration" (rather than re-implementing similar-looking checks that quietly drift apart over time), I'd pull the shared validation out of `/api/visitors` and `/api/preregister-open` into one function:

```js
// lib/visitorValidation.js
export function validateVisitorSubmission({ full_name, phone, host_id, visitor_type, ... }) {
  // the exact checks already in app/api/visitors/route.js and
  // app/api/preregister-open/route.js: full_name/phone/host_id required,
  // isValidVisitorType(visitor_type), sanitizeGroupMembers(group_members), etc.
  // returns { error } or { clean: {...} }
}
```

`/api/visitors` and `/api/preregister-open` both call this instead of repeating the checks inline; a new route does too:

- `POST /api/admin/visitors` (`requireAdmin`) - same required fields as self check-in, plus:
  - `visit_mode`: `"checked_in"` (admin is registering someone who is already here) or `"pre_registered"` (registering ahead of a future visit - requires a meeting time, same as the Edit modal's "Meeting time" field).
  - `purpose` - admin can set this immediately (unlike self check-in, where it's deliberately deferred), since the admin usually already knows why someone's visiting.
  - `notify_host` (default true) - reuses `sendHostNotification`, same as every other creation path.
  - `send_visitor_email` (default false, only shown if an email was entered) - optionally sends the visitor their own check-in-link confirmation via the existing `sendVisitorInviteEmail`, for a `pre_registered` (future-dated) entry.
  - `nda_signed_at` is set to "now" automatically (the admin is vouching for the visitor directly, same as every other creation path setting it at submission time) - there's no separate "I agree" checkbox to show an admin.
  - Skips gate approval entirely (`status` goes straight to `checked_in` or `pre_registered`, never `gate_pending`/`requested`) - an admin creating the record directly *is* the approval.

### UI

A new "**+ Add Visitor**" button on the admin Visitors page, opening a new `AddVisitorModal.jsx` - built from the same field set as `EditVisitorModal.jsx` (full name, email, phone, company, visitor type, host, group members, notes) plus the `visit_mode` choice and the meeting-time field when pre-registering ahead, and the notify toggles above. On save, the new visitor appears at the top of whichever tab matches its status.

---

## Part 3 - Returning-visitor recognition

### The real design fork (see the question at the end)

**Option A - lookup only, no schema change (recommended default below).** Keep the one-row-per-visit model exactly as it is. Add a narrow, rate-limited public lookup: given a phone number, return the most recent prior visit's reusable fields (name, company, visitor_type, host_id - **not** email, see the privacy question below) if any past row matches. The kiosk form prefills from that and the person reviews/edits before submitting, same as today just pre-filled. "Visit history" becomes "every `visitors` row with this phone number," which the admin Visitors page can already filter to via the search box (it already searches `phone`... actually it currently searches name/email/company/host/type, not phone - small fix included below to add phone to that search) - no new table, no new admin screen required for history, just a search.

**Option B - a real person/profile table.** Add `visitor_profiles` (name, phone, email, company - the stuff that repeats), have every check-in path find-or-create a profile by phone and set `visitors.profile_id`, and give the admin a profile page showing every linked visit. Cleaner "one person, many visits" modeling, and means correcting someone's name/email once updates how they're recognized next time - but it's a real migration touching every visitor-creation code path (`/api/visitors`, `/api/preregister-open`, `/api/preregister`, `/api/preregister/complete`, and the new admin route from Part 2), not just an additive table.

Default below is **Option A** - smaller, fully additive, and the "maintain a complete visit history" requirement is already satisfiable by phone number alone without a new table. I'd move to Option B later if you find yourselves wanting to edit a person's stored details in one place and have it stick for next time, rather than it just being "whatever was typed most recently."

### The lookup endpoint (and its privacy tradeoff)

```
GET /api/visitors/lookup?phone=<e164-ish digits>
```

Public (same trust model as `/api/visitors` and `/api/preregister-open` - no login at a kiosk), but this is the one piece of this whole design that's genuinely privacy-sensitive: unlike every other public endpoint in this app (which only ever *writes* a new row), this one *reads back* a real person's name/company by phone number to anyone who can type a phone number into the kiosk. Mitigations I'd build in regardless of which way the question below goes:

- Rate-limited same as every other public route (`checkRateLimit`), but with a tighter per-IP cap than normal given it's a lookup, not a one-shot submission.
- Requires an exact, fully-typed phone match (debounced until the field looks complete - no per-keystroke/partial lookups that could be used to enumerate numbers).
- Returns **name, company, visitor_type, and host_id only** - never email, even though email is stored. Email feels like the one field that turns "oh nice, it remembered me" into "wait, it just told whoever's standing at this kiosk my email address."
- The kiosk shows it as "Welcome back, *\<name\>* - we've filled in your details from last time, please check them over" with every field still fully editable, never auto-submits.

### UI integration

`VisitorDetailsForm.jsx` (shared by `WalkinForm` and the open-pre-registration form) gets the lookup wired to the phone field's `onBlur` (once it looks like a complete number): on a match, it calls `onChange` with the prefilled fields and shows the "Welcome back" banner above the form; on no match, nothing changes - today's experience, unaltered. No changes needed to `/api/visitors` or `/api/preregister-open` themselves - they already accept exactly these fields.

### Visit history for admins

Add `phone` to the admin Visitors page's existing search box (currently name/email/company/host/type - a one-line addition), and add a **"History"** link/button per row that filters the same page to every row sharing that phone number. No new API route needed - it's the same `GET /api/admin/visitors` with no status filter, searched client-side, same as the page already does.

---

## Database changes (additive only)

```sql
-- supabase/migration_did_not_visit.sql
alter table visitors drop constraint if exists visitors_status_check;
alter table visitors add constraint visitors_status_check
  check (status in (
    'requested', 'invited', 'pre_registered', 'checked_in', 'checked_out',
    'gate_pending', 'gate_approved', 'gate_denied', 'did_not_visit'
  ));

create extension if not exists pg_cron; -- optional, see Part 1
create or replace function mark_overdue_preregistrations_as_did_not_visit() returns void as $$ ... $$ language plpgsql security definer;
select cron.schedule(...);
```

No new tables unless Part 3 goes with Option B, in which case a `visitor_profiles` table and a `profile_id` column on `visitors` would be added here too.

## API changes

- `lib/visitorValidation.js` (new) - shared validation, used by `/api/visitors`, `/api/preregister-open`, and the new admin route.
- `POST /api/admin/visitors` (new) - admin-direct creation (Part 2).
- `POST /api/admin/visitors/expire-overdue` (new) - manual trigger for the Part 1 transition.
- `PATCH /api/admin/visitors/[id]` (existing, small addition) - whitelist which `status` values an admin override can set directly (`did_not_visit`, and back to `invited`/`pre_registered`/`checked_in`), rather than accepting an arbitrary string.
- `GET /api/visitors/lookup` (new) - returning-visitor lookup (Part 3).

## Frontend changes

- `app/admin/visitors/page.jsx` - add `did_not_visit` to the Completed tab/labels/badges, phone in search, "History" link, "+ Add Visitor" button.
- `components/GuardStation.jsx` - same `did_not_visit` addition to its own Completed stage (it mirrors the admin page's grouping).
- `AddVisitorModal.jsx` (new) - Part 2.
- `VisitorDetailsForm.jsx` - returning-visitor lookup + "Welcome back" banner (Part 3).
- `app/globals.css` - one new `.badge.did_not_visit` rule.

## Tests

This repo has no existing automated test suite (no test runner in `package.json`) - introducing one is a separate decision, not something to fold silently into this feature. I'd default to adding a minimal `node:test`-based suite covering the pure logic that's cheapest to get wrong and easiest to verify without a database: the "expected date" calculation (`coalesce` + Dubai calendar-date comparison) and the shared `validateVisitorSubmission` helper, run via `npm test`. Confirm you want this included before I build it the same way I built the rest.

---

## Questions I can't resolve on my own

1. **Should `invited` rows with offered-but-unpicked time slots eventually expire too**, using the latest offered slot as a fallback deadline - or only rows with a concrete `selected_time_slot`/`proposed_alternative_time`, leaving a cold invite for a human to close out?
2. **Auto-expiry mechanism**: `pg_cron` (fully automatic, needs the extension available/enabled on your Supabase project) with the manual admin route as a fallback - or skip `pg_cron` for now and rely on the manual "Run now" button alone until you confirm `pg_cron` works on your plan?
3. **Returning-visitor model**: Option A (phone lookup against existing rows, no schema change) or Option B (a real `visitor_profiles` table, bigger migration, cleaner long-term history)?
4. **Returning-visitor lookup exposure**: comfortable with name + company + visitor type + host being shown back at a public kiosk from a phone number alone (never email), or should this be pulled behind a login (e.g. only the Staff Hub / an admin can look someone up, and the public kiosk never auto-recognizes anyone)?
