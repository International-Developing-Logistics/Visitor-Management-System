-- Run this in the Supabase SQL editor for your EXISTING project.
-- This only ADDS columns and relaxes one constraint — it does not touch,
-- rename, or delete any existing rows or columns. Safe to run any time.

-- 1. Email is no longer required at check-in.
alter table visitors alter column email drop not null;

-- 2. Group check-in: how many additional guests came with the primary
--    visitor, and (optionally) their names as free text.
alter table visitors add column if not exists additional_visitor_count integer not null default 0;
alter table visitors add column if not exists additional_visitor_names text;

-- Existing rows are untouched — additional_visitor_count defaults to 0 for
-- all of them, exactly representing "no group" for historical check-ins.
