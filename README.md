# Visitor Check-in

A visitor management app: walk-in kiosk check-in (QR + tablet), pre-registration
with proposed meeting times and group check-in, a gate approval flow for
unscheduled walk-ins, a contractor pass system, and automatic host email
notifications.

Built with Next.js, Supabase (database, file storage), and Resend (email). Runs
free on the free tiers of all three for typical small-company visitor volume.

## What's included

- `/` — kiosk home screen with QR code + "check in on this tablet" button
- `/walkin` — walk-in flow: details (email optional, group check-in) -> agree to terms -> confirmation
- `/preregister` — (staff-only) send a visitor a pre-registration link, with
  group check-in and proposed meeting times, rendered as a copyable link or
  a custom-text hyperlink (e.g. "Click here to join") for pasting into email/chat
- `/request-invite` — (no login — for hosts) request a pre-registration invite for a guest; goes to admin for review, doesn't send anything on its own
- `/checkin?token=...` — the visitor's link: completes their profile ahead of
  time (group info, picking a meeting time if offered), then on a return
  visit shows a one-tap "I'm here" arrival button
- `/gate` — a minimal, no-login form (name + purpose) for a QR code at the
  entrance gate, for unscheduled walk-ins — see below
- `/contractor-register` and `/contractor-pass?token=...` — contractor pass
  registration and self-service pass lookup — see below
- `/admin` — (staff-only) live dashboard across every flow above: Requests,
  Gate, Checked in, Expected, Checked out tabs; phone number, check-in AND
  check-out times, group size, meeting time, an Edit action (including
  fixing an accidental checkout time), manual check-in for pre-registered
  or gate-approved guests, and a monthly CSV export
- `/admin/hosts` — (staff-only) add/remove hosts without touching Supabase
- `/admin/contractors` — (staff-only) activate, deactivate, or edit contractor passes
- Host email notifications on check-in, pre-registration, and gate approval requests
- Supabase Auth protects everything under `/admin`, `/preregister`, and `/admin/contractors`
- Visitor agreement to terms is a required checkbox, not a drawn signature
  (see "Agreement checkbox" below)
- Contractor passport uploads go to a **private** Supabase Storage bucket
- Basic rate limiting on every public (no-login) endpoint
- An optional `supabase/retention.sql` script if you want old visitor
  records auto-deleted after N days

## Agreement checkbox (not a signature)

Both `/walkin` and the guest's own `/checkin?token=...` completion step show
the visitor terms as text, followed by a mandatory "I have read and agree to
the terms above" checkbox — submission is blocked until it's checked. There's
no drawn signature and nothing captured beyond a timestamp
(`nda_signed_at`) recording when they agreed. If you had visitors check in
under an older version of this app, their `signature_url` values (if any)
remain in the database untouched — nothing here deletes historical data —
they're just no longer collected or displayed going forward.

## How the host-request flow works

Hosts don't get logins. Instead:
1. A host opens `/request-invite` (share this URL with staff directly — e.g.
   pin it in your intranet or send it once by email; it's not linked from
   the kiosk since it's not meant for visitors) and submits a guest's email,
   their own name (from the same host list), purpose, and optionally group
   and meeting-time details.
2. This creates a `requested` record — nothing is sent to the guest yet.
3. Staff see it under `/admin`'s **Requests** tab, and can either
   **"Approve & email"** (sends the link to the guest directly) or
   **"Approve, get link"** (staff gets a copyable/hyperlinkable link to send
   themselves — useful if you'd rather text/WhatsApp it, or the guest's
   email isn't reliable).

## Sharing an invite link as a hyperlink

Once a link is generated (from `/preregister` or an approved request in
`/admin`), you can copy it two ways: as a plain URL, or as a rich hyperlink
with custom text (default "Click here to join," editable) — pasting the
latter into Gmail, Outlook, or Slack renders a clickable link with your
chosen wording instead of a raw URL. Falls back to a plain-text copy
automatically on browsers that don't support rich clipboard writes.

## Timezone handling (fixed)

Earlier versions had a real bug: time slots typed by a host/staff member
were silently reinterpreted using whatever timezone the **server** happened
to be running in (Vercel functions run in UTC), not Dubai — so "2:00 PM"
could be stored 4 hours off. This is fixed by converting to UTC at the
moment of entry, on the browser, anchored explicitly to `Asia/Dubai` (see
`lib/timezone.js` — Dubai has no daylight saving time, so a fixed +4:00
offset is always correct; if you ever operate out of a DST-observing
timezone, this simple approach would need replacing with a proper timezone
library). Everywhere staff enter or view a time (slot creation, the Edit
modal, host emails, the admin dashboard) is now explicitly anchored to
Dubai. Everywhere a guest views a time (`/checkin`), it's shown in **both**
their own device's local time and explicit Dubai time, so there's no
ambiguity either way.

## Guest time proposal

If none of a host's proposed time slots work, a guest completing
`/checkin?token=...` can click "None of these work — propose a different
time" and pick their own preferred date/time (in their own local time —
converted correctly since it's captured on their own device). This is
stored in `proposed_alternative_time` and shown to the host in their
notification email and to staff in the admin dashboard / Edit modal, where
saving the pre-filled meeting time field there is how staff "accept" it
(copies it into `selected_time_slot`).

## Open pre-registration page

`/preregister-open` — fully public, no invite link needed. A guest fills in
their own details (same fields as `/walkin`, minus needing to be physically
present), optionally proposes a preferred time, agrees to the terms, and is
immediately pre-registered — their host is notified right away, and they're
given their own check-in link to save and use on arrival day (same one they'd
get from any other pre-registration path). This uses the same open trust
model as `/walkin` — no approval gate — since the host still sees every
submission immediately by email. Share this page's link wherever guests
might book a visit in advance (a company website, a booking email, etc.).

## Proposed meeting times

Whoever creates the invite — a host via `/request-invite` or staff via
`/preregister` — can optionally offer a few time slots. If any are set, the
guest sees them as a pick-one list when completing their pre-registration
(skipped entirely if no times were proposed). The chosen time shows in the
host's notification email and in the admin dashboard's "Meeting Time"
column, and can be corrected from the Edit modal if needed.

## Gate walk-in approval flow

`/gate` — a minimal, no-login form (full name + purpose only) meant for a QR
code posted at the entrance gate, for unexpected/unscheduled visitors. On
submission it emails whoever is configured in `ADMIN_NOTIFICATION_EMAIL`
and/or `HR_NOTIFICATION_EMAIL` an **Approve** / **Deny** link — clicking
either works instantly with no login (the link itself is the credential,
same pattern as the pre-registration links). Once approved, the visitor
shows up in `/admin`'s **Gate** tab with a **Check in** button — staff
assign a host via Edit if needed, then check them in normally. Denied
visitors just stay on record as denied, nothing further happens.

## Contractor pass system

Separate from one-off visitor check-ins, for people who need repeated
access over a project's duration:

- `/contractor-register` — public registration: name, email, company,
  resident ID, passport upload (JPG/PNG/PDF, capped at 3MB), and estimated
  duration needed. Creates a `pending` pass and gives the contractor a link
  to their pass page.
- `/contractor-pass?token=...` — the contractor's own pass: shows their
  name, company, status, and validity window, plus a QR code of the same
  link (so it can be shown or printed at a gate). Never shows the passport
  image or resident ID — those stay admin-only.
- `/admin/contractors` — staff activate (setting a validity window),
  deactivate, or edit any registration, and can view the passport via a
  short-lived signed link.

## Setup

### 1. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com), create a free project.
2. In the SQL Editor, run the contents of `supabase/schema.sql`. This creates
   every table (`hosts`, `visitors`, `contractors`) and seeds two example
   hosts — edit those rows (or add your real hosts) in the Table Editor, or
   from `/admin/hosts` once the app is running.
3. In **Storage**, create one bucket: `contractor-documents`. Leave it
   **private** (the default) — the app uploads with the service role key
   and generates short-lived signed URLs on demand for admin viewing.
4. In **Project Settings -> API**, copy the Project URL, `anon` public key,
   and `service_role` key.
5. In **Authentication -> Users**, click **Add user** and create one login
   per staff member who should have access to `/admin`, `/preregister`, and
   `/admin/contractors` (e.g. reception, office manager, HR). Use "Create
   new user" with a password — no email confirmation flow needed for an
   internal tool. These are the credentials staff use to sign in at
   `/admin/login`.

**If you're upgrading an existing project instead of starting fresh**, run
these in the SQL Editor in order (all additive — none touch, rename, or
delete existing hosts/visitors):
1. `supabase/migration_email_optional_and_groups.sql`
2. `supabase/migration_host_requests.sql`
3. `supabase/migration_time_slots.sql`
4. `supabase/migration_gate_and_contractors.sql`
5. `supabase/migration_contractor_company.sql`
6. `supabase/migration_guest_time_proposal.sql`

### 2. Create a Resend account (free, 100 emails/day)

1. Go to [resend.com](https://resend.com), create a free account.
2. Copy your API key. For real deployments, verify your own sending domain
   (Resend walks you through adding a couple of DNS records) so emails come
   from `checkin@yourcompany.com` instead of the shared `resend.dev` domain,
   and aren't limited to only sending to your own signup address.

### 3. Configure environment variables

```
cp .env.example .env.local
```

Fill in the Supabase and Resend values from steps 1-2. See `.env.example`
for the full list, including optional ones (`ADMIN_NOTIFICATION_EMAIL`,
`HR_NOTIFICATION_EMAIL`, `EMAIL_REPLY_TO`, `NEXT_PUBLIC_COMPANY_NAME`).

### 4. Run it locally

```
npm install
npm run dev
```

Open `http://localhost:3000`. Try the walk-in flow at `/walkin`, invite a
guest at `/preregister`, or register a contractor at `/contractor-register`.

### 5. Deploy (free)

1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com), import the repo.
3. Add the same environment variables from `.env.local` in the Vercel project
   settings (Settings -> Environment Variables).
4. Deploy.

### 6. Set up the reception tablet

- Open your production URL in the tablet's browser.
- Put the tablet in **kiosk/guided-access mode** so visitors can't leave the
  app (iPad: Settings -> Accessibility -> Guided Access; Android tablets:
  most MDM or "kiosk browser" apps, e.g. Fully Kiosk Browser, work well).
- Optionally print the QR code shown on `/` and place it at the desk too, so
  visitors can check in on their own phone instead of touching the shared
  tablet. Print a separate one pointing at `/gate` for the entrance gate.

## How the flows map to the code

**Walk-in**: `/walkin` collects everything in one sitting and calls
`POST /api/visitors` once, with `visit_type: "walkin"`. Inserts the visitor
row with `status: "checked_in"` and emails the host immediately.

**Pre-registration**: three steps, three routes.
1. `POST /api/preregister` (from `/preregister`, or `POST
   /api/admin/requests/[id]/approve` for an approved host request) creates
   a row with `status: "invited"` and a `checkin_token`.
2. The visitor opens `/checkin?token=...` ahead of time; it sees `status ===
   "invited"` and shows the details form. Submitting calls `POST
   /api/preregister/complete`, which fills in the row and sets `status:
   "pre_registered"`.
3. On arrival, the visitor reopens the same link (or staff use the
   dashboard's manual "Check in" button); this sets `status: "checked_in"`
   and notifies the host.

**Gate walk-in**: `POST /api/gate` creates a row with `status:
"gate_pending"` and emails an Approve/Deny link (`GET /api/gate/approve`).
Approving sets `status: "gate_approved"`; staff then check them in from
`/admin` same as a pre-registered guest.

**Contractors**: entirely separate `contractors` table, not part of the
`visitors` flow. `POST /api/contractors` creates a `pending` pass; staff
activate/deactivate/edit from `/admin/contractors` via `PATCH
/api/admin/contractors/[id]`.

## Admin portal

`/admin`, `/preregister`, and `/admin/contractors` are gated by
`components/AdminGuard.jsx`, which checks for a Supabase Auth session and
redirects to `/admin/login` if there isn't one. The API routes under
`/api/admin/**` (and `/api/preregister`) independently re-check the caller's
session token server-side via `lib/verifyAdmin.js` — the page-level guard is
just a fast redirect for UX, the API check is what actually keeps the data
safe.

## Notes on the security choices above

- **Storage**: the `contractor-documents` bucket is private; every passport
  URL that leaves the server is short-lived (signed, expires).
- **Rate limiting**: every public endpoint caps requests per IP per minute
  using an in-memory counter (see `lib/rateLimit.js`). This resets on cold
  start and is per-instance, so it's a speed bump against runaway scripts,
  not a guarantee against a distributed attack. If that ever matters for
  your traffic, swap in [Upstash Redis](https://upstash.com) (free tier)
  with `@upstash/ratelimit` — same function signature, durable across
  instances.
- **Gate/request approval links**: work without login by design — the
  random token in the URL is the credential (same pattern as pre-registration
  links). Don't forward these emails to anyone who shouldn't be able to
  approve/deny on your behalf.
- **Retention**: `supabase/retention.sql` is optional — it auto-deletes old
  visitor database rows on a schedule if you enable it. It doesn't cover the
  `contractors` table or delete underlying storage files — ask if you'd like
  it extended.
