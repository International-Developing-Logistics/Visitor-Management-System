-- Run this in the Supabase SQL editor for your EXISTING project.
-- Purely additive — adds one nullable column, doesn't touch existing data.

alter table contractors add column if not exists company text;
