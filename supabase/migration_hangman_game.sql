-- Run this in the Supabase SQL editor for your EXISTING project.
-- Two new tables only — doesn't touch any existing data or accounts.
--
-- Powers the shared Hangman game (app/hangman, app/api/hangman). It's a
-- single ongoing shared board — everyone who visits sees the same word,
-- the same guessed letters, and the same remaining tries. When a round is
-- won or lost, the very next visit auto-starts the next word from
-- lib/hangmanWords.js (tracked via word_index, cycling back to the start
-- once the list runs out).
--
-- Public feature, no login — hangman_rounds.word is the only place the
-- secret answer is stored; the API route never sends it to the browser
-- until a round finishes. Players type a free-text nickname (not an
-- account) so the leaderboard has something to attribute guesses to —
-- there's no verification behind it, same trust model as the rest of
-- this app's public pages (see HANDOVER.md §1.4). Nickname matching on
-- hangman_scores is a plain, case-sensitive equality match — "Bob" and
-- "bob" score separately. Fine for a for-fun feature; tighten later with
-- a case-insensitive unique index if that ever bothers anyone.

create table if not exists hangman_rounds (
  id uuid primary key default gen_random_uuid(),
  word_index int not null,
  word text not null,
  guessed_letters text[] not null default '{}',
  wrong_guesses int not null default 0,
  max_wrong int not null default 6,
  status text not null default 'playing' check (status in ('playing', 'won', 'lost')),
  winning_nickname text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create table if not exists hangman_scores (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  points int not null default 0,
  rounds_won int not null default 0,
  updated_at timestamptz not null default now()
);

alter table hangman_rounds enable row level security;
alter table hangman_scores enable row level security;

-- No public policies, same lockdown as every other table — all access
-- goes through app/api/hangman using the Supabase service role key.
