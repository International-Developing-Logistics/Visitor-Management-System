# Visitor Check-in

A small visitor management app: walk-in kiosk check-in (QR + tablet), pre-registration
by email, photo capture, NDA e-signature, and automatic host email notifications.

Built with Next.js, Supabase (database, file storage), and Resend (email). Runs
free on the free tiers of all three for typical small-company visitor volume.

## What's included

- `/` — kiosk home screen with QR code + "check in on this tablet" button
- `/walkin` — walk-in flow: details -> photo -> NDA signature -> confirmation
- `/preregister` — (staff-only) send a visitor a pre-registration link by email
- `/checkin?token=...` — the visitor's link: completes their profile ahead of
  time, then on a return visit shows a one-tap "I'm here" arrival button
- `/admin` — (staff-only) live dashboard: who's checked in, who's expected,
  who's checked out, with photo thumbnails and a check-out button
- `/admin/hosts` — (staff-only) add/remove hosts without touching Supabase
- Host email notifications on check-in and on pre-registration, via Resend,
  with the visitor's photo embedded so the host can recognize them
- Supabase schema for `hosts` and `visitors`
- Supabase Auth protects everything under `/admin` and `/preregister`
- Visitor photos and signatures are stored in **private** Supabase Storage
  buckets — nothing is reachable by a guessable or permanent public URL; the
  app generates short-lived signed links only when a host email is sent or
  the dashboard displays a thumbnail
- Basic rate limiting on the public check-in endpoints, so they can't be
  spammed from outside the building
- An optional `supabase/retention.sql` script if you want old visitor
  records auto-deleted after N days

## 1. Create a Supabase project (free)

1. Go to [supabase.com](https://supabase.com), create a free project.
2. In the SQL Editor, run the contents of `supabase/schema.sql`. This creates
   the `hosts` and `visitors` tables and seeds two example hosts — edit those
   rows (or add your real hosts) in the Table Editor afterward.
3. In **Storage**, create two buckets: `visitor-photos` and `visitor-signatures`.
   Leave both set to **private** (the default) — the app never needs them
   public. It uploads with the service role key and generates short-lived
   signed URLs on demand (in host emails, and for thumbnails in `/admin`).
4. In **Project Settings -> API**, copy the Project URL, `anon` public key,
   and `service_role` key.
5. In **Authentication -> Users**, click **Add user** and create one login
   per staff member who should have access to `/admin` and `/preregister`
   (e.g. reception, office manager). Use "Create new user" with a password —
   no email confirmation flow needed for an internal tool. These are the
   credentials staff use to sign in at `/admin/login`.

## 2. Create a Resend account (free, 100 emails/day)

1. Go to [resend.com](https://resend.com), create a free account.
2. Copy your API key. For real deployments, verify your own sending domain
   (Resend walks you through adding a couple of DNS records) so emails come
   from `checkin@yourcompany.com` instead of the shared `resend.dev` domain.

## 3. Configure environment variables

```
cp .env.example .env.local
```

Fill in the Supabase and Resend values from steps 1-2.

## 4. Run it locally

```
npm install
npm run dev
```

Open `http://localhost:3000`. Try the walk-in flow at `/walkin` (your browser
will ask for camera permission), and send yourself a pre-registration invite
at `/preregister`.

## 5. Deploy (free)

1. Push this folder to a GitHub repo.
2. Go to [vercel.com](https://vercel.com), import the repo.
3. Add the same environment variables from `.env.local` in the Vercel project
   settings (Settings -> Environment Variables).
4. Deploy. You'll get a URL like `visitor-checkin.vercel.app`.

## 6. Set up the reception tablet

- Open `https://your-app.vercel.app/` in the tablet's browser.
- Put the tablet in **kiosk/guided-access mode** so visitors can't leave the
  app (iPad: Settings -> Accessibility -> Guided Access; Android tablets:
  most MDM or "kiosk browser" apps, e.g. Fully Kiosk Browser, work well).
- Optionally print the QR code shown on `/` and place it at the desk too, so
  visitors can check in on their own phone instead of touching the shared
  tablet.

## How the two flows map to the code

**Walk-in**: `/walkin` collects everything in one sitting and calls
`POST /api/visitors` once, with `visit_type: "walkin"`. That route uploads
the photo/signature to Supabase Storage, inserts the visitor row with
`status: "checked_in"`, and emails the host immediately.

**Pre-registration**: three steps, three routes.
1. `POST /api/preregister` (from `/preregister`) creates a stub row
   (`status: "invited"`) and emails the visitor a `/checkin?token=...` link.
2. The visitor opens that link ahead of time; `/checkin` sees `status ===
   "invited"` and shows the same details/photo/signature form. Submitting
   calls `POST /api/preregister/complete`, which fills in the row and sets
   `status: "pre_registered"`.
3. On arrival, the visitor reopens the same link; `/checkin` now sees
   `status === "pre_registered"` and shows a single "I'm here" button, which
   calls `POST /api/checkin` to set `status: "checked_in"` and notify the
   host.

## Admin portal

`/admin` and `/preregister` are gated by `components/AdminGuard.jsx`, which
checks for a Supabase Auth session and redirects to `/admin/login` if there
isn't one. The API routes under `/api/admin/**` (and `/api/preregister`)
independently re-check the caller's session token server-side via
`lib/verifyAdmin.js` — the page-level guard is just a fast redirect for UX,
the API check is what actually keeps the data safe.

- **Dashboard** (`/admin`): filters by status (checked in / expected /
  checked out), and a "Check out" button that sets `checked_out_at`.
- **Hosts** (`/admin/hosts`): add or remove hosts without opening Supabase.

## Notes on the security choices above

- **Storage**: buckets are private; every photo/signature URL that leaves the
  server is short-lived (signed, expires). Run `supabase/schema.sql` as-is —
  there's nothing extra to configure.
- **Rate limiting**: the public endpoints (`/api/visitors`, `/api/checkin`,
  `/api/preregister/complete`) cap requests per IP per minute using an
  in-memory counter (see `lib/rateLimit.js`). This resets on cold start and
  is per-instance, so it's a speed bump against runaway scripts, not a
  guarantee against a distributed attack. If that ever matters for your
  traffic, swap in [Upstash Redis](https://upstash.com) (free tier) with
  `@upstash/ratelimit` — same function signature, durable across instances.
- **Retention**: `supabase/retention.sql` is optional — it auto-deletes old
  visitor database rows on a schedule if you enable it. It does not delete
  the underlying photo/signature files (that needs the Storage API, not raw
  SQL); ask if you'd like a small cron route added to purge those too once
  you've decided on a retention period.
