-- Warehouse Photos (Staff Hub): staff attach 5-20 photos to a GRN.
-- New table + private bucket only - doesn't touch any existing data.
-- (Already applied to production on 2026-11-23.)

create table if not exists public.warehouse_photo_submissions (
  id uuid primary key,
  facility text not null default 'harmony',
  staff_name text not null,
  client_name text not null,
  grn text not null,
  container_count integer not null check (container_count >= 0 and container_count <= 1000),
  photo_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists warehouse_photo_submissions_created_idx
  on public.warehouse_photo_submissions (facility, created_at desc);
create index if not exists warehouse_photo_submissions_grn_idx
  on public.warehouse_photo_submissions (lower(grn));

-- Same lockdown as every other table: no public policies, all access goes
-- through the app's API routes with the service role key.
alter table public.warehouse_photo_submissions enable row level security;

-- Private bucket. Photos are resized to JPEG in the browser before upload,
-- so the 5MB / JPEG-only limits are a backstop, not something staff hit.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('warehouse-photos', 'warehouse-photos', false, 5242880, array['image/jpeg'])
on conflict (id) do nothing;
