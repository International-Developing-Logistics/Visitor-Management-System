-- Run this in the Supabase SQL editor for your EXISTING project.
-- Safe to run whether or not you've already run migration_hangman_game.sql
-- and migration_crossword_game.sql — the CREATE TABLE lines are skipped if
-- those tables already exist, and the ADD COLUMN lines are skipped if the
-- column's already there.
--
-- Hangman and Crossword both switched from one shared board everyone
-- played together to each player getting their own private round — see
-- app/api/hangman/route.js and app/api/crossword/route.js. That's what
-- the new `nickname` column is for: a round now belongs to one player, so
-- their score is entirely their own instead of whoever happened to click
-- fastest on a shared board.
--
-- Any rounds already sitting in these tables from the old shared model
-- have no nickname and are just abandoned — they'll never be matched by
-- the new per-player lookup, so there's nothing else to clean up.

create table if not exists hangman_rounds (
  id uuid primary key default gen_random_uuid(),
  word_index int not null,
  word text not null,
  guessed_letters text[] not null default '{}',
  wrong_guesses int not null default 0,
  max_wrong int not null default 6,
  status text not null default 'playing' check (status in ('playing', 'won', 'lost')),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table hangman_rounds add column if not exists nickname text;

create table if not exists hangman_scores (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  points int not null default 0,
  rounds_won int not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists crossword_rounds (
  id uuid primary key default gen_random_uuid(),
  puzzle_index int not null,
  revealed_cells jsonb not null default '[]',
  status text not null default 'playing' check (status in ('playing', 'solved')),
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
alter table crossword_rounds add column if not exists nickname text;

create table if not exists crossword_scores (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  points int not null default 0,
  puzzles_solved int not null default 0,
  updated_at timestamptz not null default now()
);

alter table hangman_rounds enable row level security;
alter table hangman_scores enable row level security;
alter table crossword_rounds enable row level security;
alter table crossword_scores enable row level security;

-- No public policies, same lockdown as every other table — all access
-- goes through app/api/hangman and app/api/crossword using the Supabase
-- service role key.
