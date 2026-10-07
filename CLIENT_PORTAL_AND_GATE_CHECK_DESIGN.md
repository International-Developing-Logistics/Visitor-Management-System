# Design: Gate Check Form Integration + Client Portal

Status: **proposal, not yet built** — written for review before implementation starts, same convention as the rest of this project's non-trivial changes.

This covers two separate pieces of work: (1) bringing the standalone `Container_Gate_Check_Form.html` into the app so staff/guards fill it in and submit it through the server, and (2) a new client-facing portal with isolated per-client file access. They share almost no code, so they're designed and can be built independently.

---

## Part A — Container Gate Check Form

### What it is today

A fully self-contained HTML file: ~70 fields across 11 sections (arrival, company, driver, truck/trailer, container, seals, inspection, documents, discrepancies), 5 signature pads (canvas → PNG), a company stamp photo, and 7 required photo captures with EXIF date/GPS extraction. Everything lives in the browser's `localStorage`/`IndexedDB` — there's no server involved at all, and "saving" just means "saved in this one browser on this one computer." That's the problem to fix: nothing is shared across devices, nothing is backed up centrally, and nobody but the person who filled it in can ever see it again.

### Recommended approach

Rebuild it as a real page in the app (a new route, e.g. `/gate-check-form` + `/idl/gate-check-form` mirroring the existing per-facility pattern), submitting to a server API route and storing the record in Supabase — same shape as every other form in this app (Vehicle Request, Equipment Log, etc.).

**Keep from the original:** the section/field structure (it's a good, already-tested data model), the ISO 6346 container check-digit validator, the EXIF-based photo date/GPS extraction, the print/PDF stylesheet and photo appendix layout.

**Drop from the original:** the whole "Saved forms" library/import/export/multi-draft system. That machinery exists only because the form had no backend — once it's server-backed, a gate check becomes a single submit-once record (like a Vehicle Request), not a personal local library of drafts. I'd keep a lightweight local draft (auto-save to `localStorage` as crash recovery while filling it in, cleared on submit) but drop the saved-forms drawer, JSON import/export, and multi-form search entirely.

**Signatures & photos:** stored as files in a new private Supabase Storage bucket (`gate-check-forms`), not as inline base64 in the database — same pattern already used for Equipment Log's hour-meter/damage photos (`lib/storage.js`'s `uploadPrivateFile` / `signMany`). The database row stores storage paths; the admin view generates signed URLs to display them.

### Who can submit it — needs your decision

This is a **security/gate function** (container receiving, seals, customs), which in this app's existing role model is `guard` + `admin` territory (`requireAdminOrGuard`, same as Gate Operations and Security Log) — not the `staff` tier, which covers office things like Vehicle Request and IT Tickets. You said "staff members," which may just mean "our people" generally, or may specifically mean the `staff` role. I'd default to **admin + guard**, matching every other gate/security feature in the app, but can open it to `staff` too (or instead) if the people physically doing container receiving aren't logged in as guards. This is the one access-permission question I can't resolve on my own — see the question at the end.

### Database structure

```sql
create table if not exists gate_check_forms (
  id uuid primary key,
  facility text not null default 'harmony',
  form_no text not null,

  -- Pulled out as real columns because the admin list needs to filter/sort
  -- on them; every other field lives in `fields` below (mirrors how the
  -- rest of this app keeps a few searchable columns and pushes the long
  -- tail into one blob rather than ~70 individual columns).
  container_no text,
  truck_plate text,
  driver_name text,
  decision text check (decision in ('Accept', 'Hold', 'Reject') or decision is null),
  check_date date,

  fields jsonb not null,       -- every other field from the 11 sections, keyed same as the form's own `data-k` attributes
  signatures jsonb,            -- { officer: {name, time, photo_path}, supervisor: {...}, driver: {...}, receiver: {...}, receipt: {name, photo_path} }
  stamp_photo_path text,
  photos jsonb,                -- [{ field, label, file_name, taken_at, taken_source, gps, photo_path }, ...] for the 7 capture slots

  submitted_by uuid references auth.users(id),
  submitted_by_email text,
  created_at timestamptz not null default now()
);

alter table gate_check_forms enable row level security;
-- No public policies — same lockdown as every other table in this app, all access via the service-role key in API routes.
```

### API routes

- `POST /api/gate-check-forms` — `requireAdminOrGuard`. Accepts the field blob + uploaded signature/photo files, writes the row, uploads files to Storage.
- `GET /api/admin/gate-check-forms?facility=` — `requireAdminOrGuard`. List for the admin/guard view, same facility-filter pattern as every other admin list.
- `GET /api/admin/gate-check-forms/[id]` — single record with signed URLs for signatures/photos/stamp, for the print/detail view.

### UI

- Submission page: the 11 sections rendered as a long form (reuses `VisitorDetailsForm.jsx`-style patterns for text/radio fields), a new reusable `SignaturePad.jsx` component (canvas capture, doesn't exist yet — 5 fields need it), and photo capture reusing `CameraCapture.jsx`'s approach extended with file-upload + EXIF reading.
- Admin view: a new "Gate Check Forms" item under the Security nav group, listing submissions with the existing table pattern, each row opening a read-only detail/print view.

---

## Part B — Client Portal

### The core security problem to design around

This app's existing role system has one rule that is *actively dangerous* to reuse here: in `lib/verifyAdmin.js`, **any Supabase Auth account with no row in `user_roles` defaults to full admin access.** That's deliberate and fine for internal employee accounts (it's what keeps every pre-existing login working), but it means a client account dropped into the same pool without a role row would silently get *full admin access to the entire visitor/vehicle/equipment/IT-ticket system* — the opposite of what you're asking for. The design below exists specifically to make that impossible by construction, not just by convention.

### Recommended approach: separate identity table, same Supabase Auth

Reuse Supabase Auth itself (email/password, invite emails — the same mechanism I just built for Users & Roles) rather than building a parallel auth system from scratch, but keep clients in their own table that is checked *first* and has **no default-grant fallback**:

- A new `lib/verifyClient.js` with `requireClient(req)` — resolves the caller against `client_accounts` only. No match means unauthorized, full stop — there is no "default role" for a client the way there is for staff.
- Every existing internal verifier (`requireAdmin`, `requireAdminOrGuard`, `requireRole`) gets one added line: if the account has a `client_accounts` row, it is never treated as staff, regardless of what (if anything) is in `user_roles`. This is defense-in-depth — a client should never get a `user_roles` row in the first place, but a single bug or manual Table Editor mistake shouldn't be able to turn a client into an admin.
- Clients sign in at a separate route (`/client/login`), never `/admin/login`, and a new `ClientGuard` component (mirroring `AdminGuard`) keeps them out of every `/admin`, `/guard`, `/staff` page even if they somehow had a valid session there.

### Database structure

```sql
-- The client organization/customer itself.
create table if not exists clients (
  id uuid primary key,
  name text not null,
  facility text references facilities, -- optional, if a client is tied to one facility
  created_at timestamptz not null default now()
);

-- Login accounts. Deliberately a separate table from user_roles — a client
-- login must never be confused with an internal admin/guard/staff login.
-- One client can have several people/logins (client_id isn't unique);
-- one login belongs to exactly one client (user_id is the primary key).
create table if not exists client_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

-- Files made visible to a client. Storage lives in a PRIVATE bucket
-- (never public), path-namespaced per client so a leaked/guessed path
-- alone can't reach another client's file: client-files/<client_id>/<uuid>-<filename>
create table if not exists client_files (
  id uuid primary key,
  client_id uuid not null references clients(id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  content_type text,
  size_bytes bigint,
  downloadable boolean not null default true, -- lets admin mark a file view-only vs. downloadable
  uploaded_by uuid references auth.users(id),
  uploaded_at timestamptz not null default now()
);

alter table clients enable row level security;
alter table client_accounts enable row level security;
alter table client_files enable row level security;
-- No public policies — all access via service-role key in API routes, same as every other table here.
```

### The isolation guarantee, concretely

Every client-facing API route does the same two-step check, every single time, never trusting an ID the client supplies alone:

1. Resolve the caller's `client_id` from `client_accounts` via `requireClient(req)`.
2. For *any* file operation (list, download, metadata), filter or re-verify against that `client_id` server-side — e.g. a download route doesn't just trust a `fileId` in the URL, it loads the file's row and checks `file.client_id === caller.client_id` before generating a signed URL. This is what actually prevents Client A from reaching Client B's file even if they guess or share a file ID.

### User roles & access matrix

- **Admin** (existing role) — creates clients, invites client logins (same `inviteUserByEmail` pattern as Users & Roles), uploads/removes files per client, toggles a file downloadable vs. view-only.
- **Client** (new) — signs in at `/client/login`, sees only their own files on `/client`, can download anything marked downloadable. No visibility into any other part of the app, and no visibility into other clients.
- Guard/staff — no involvement in this feature at all.

### API routes

- `GET/POST /api/admin/clients` — `requireAdmin`. List/create clients.
- `POST /api/admin/clients/[id]/invite` — `requireAdmin`. Invites a login for that client (mirrors the Users & Roles invite flow, but writes to `client_accounts` instead of `user_roles`).
- `GET/POST /api/admin/clients/[id]/files` — `requireAdmin`. List/upload files for a client.
- `DELETE /api/admin/clients/[id]/files/[fileId]` — `requireAdmin`.
- `GET /api/client/files` — `requireClient`. Lists only the caller's own files.
- `GET /api/client/files/[fileId]/download` — `requireClient`, with the ownership re-check described above before issuing a signed URL.

### UI

- Admin: a new "Clients" page under Administration (parallel to Users & Roles) — client list, per-client file manager (upload, remove, toggle downloadable), invite a client login.
- Client: a minimal `/client` dashboard — login, "My Files" (name, type, size, uploaded date, download button when downloadable), nothing else, no app chrome from the internal admin shell.

### Open question this design doesn't resolve on its own

Whether clients should ever be able to *upload* something back (e.g. a signed document), or this is strictly one-way (admin uploads → client downloads), as the original request describes. One-way is simpler and has no virus-scanning/abuse surface to worry about, so that's the default below unless you want upload added.

---

## Suggested build order

1. Gate Check Form — smaller, reuses existing patterns end-to-end, no new security model needed.
2. Client Portal — migration + `verifyClient.js` + admin-side client/file management first, then the client-facing login/dashboard last (so the isolation logic is fully in place and testable before any real client ever sees a login screen).
