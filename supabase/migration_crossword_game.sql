-- Run this in the Supabase SQL editor for your EXISTING project.
-- Two new tables only — doesn't touch any existing data or accounts.
--
-- Powers the shared Crossword game (app/crossword, app/api/crossword) —
-- same collaborative model as Hangman (see migration_hangman_game.sql):
-- one puzzle live at a time, everyone fills in the same grid, correct
-- letters stay revealed for everyone once anyone gets them. When the
-- puzzle is fully solved, the next visit auto-starts the next puzzle
-- from lib/crosswordPuzzles.js (tracked via puzzle_index, cycling back
-- to the start once the list runs out — with one puzzle in the list
-- today, that just restarts the same one).
--
-- Public feature, no login. revealed_cells only ever stores letters that
-- were already confirmed correct server-side — a wrong guess is rejected
-- immediately and never written here, so there's nothing to "undo".
-- Nicknames are free text, not accounts — same trust model as Hangman
-- and the rest of this app's public pages (see HANDOVER.md §1.4).

create table if not exists crossword_rounds (
  id uuid primary key default gen_random_uuid(),
  puzzle_index int not null,
  revealed_cells jsonb not null default '[]', -- [{ "row": 0, "col": 0, "letter": "s" }, ...]
  status text not null default 'playing' check (status in ('playing', 'solved')),
  solved_by text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists crossword_scores (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  points int not null default 0,
  puzzles_solved int not null default 0,
  updated_at timestamptz not null default now()
);

alter table crossword_rounds enable row level security;
alter table crossword_scores enable row level security;

-- No public policies, same lockdown as every other table — all access
-- goes through app/api/crossword using the Supabase service role key.
