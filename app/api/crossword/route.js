import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { CROSSWORD_PUZZLES } from "@/lib/crosswordPuzzles";

const MAX_NICKNAME_LENGTH = 30;
const CELL_POINTS = 1;
const SOLVE_BONUS = 6;

function isBlock(puzzle, row, col) {
  return puzzle.blocks.some(([r, c]) => r === row && c === col);
}

function totalFillableCells(puzzle) {
  return puzzle.size * puzzle.size - puzzle.blocks.length;
}

// Builds the full answer grid from the puzzle's across/down entries, and
// sanity-checks that every entry agrees with every other entry at each
// crossing cell — catches a typo in lib/crosswordPuzzles.js immediately
// (as a thrown error) instead of shipping a grid that can never be fully
// solved.
const solvedGridCache = new Map();
function solvedGridFor(puzzleIndex) {
  if (solvedGridCache.has(puzzleIndex)) return solvedGridCache.get(puzzleIndex);
  const puzzle = CROSSWORD_PUZZLES[puzzleIndex];
  const grid = Array.from({ length: puzzle.size }, () => new Array(puzzle.size).fill(null));
  for (const entry of puzzle.entries) {
    const [dr, dc] = entry.direction === "across" ? [0, 1] : [1, 0];
    for (let i = 0; i < entry.answer.length; i++) {
      const r = entry.row + dr * i;
      const c = entry.col + dc * i;
      const letter = entry.answer[i];
      if (grid[r][c] && grid[r][c] !== letter) {
        throw new Error(
          `crosswordPuzzles.js puzzle ${puzzleIndex}: entry ${entry.number}-${entry.direction} conflicts with another entry at row ${r}, col ${c}`
        );
      }
      grid[r][c] = letter;
    }
  }
  solvedGridCache.set(puzzleIndex, grid);
  return grid;
}

// Each player solves their own private copy of the grid — not a shared
// board — so their score is entirely their own. A round belongs to a
// nickname; fetches that player's current in-progress round, or starts
// their next one (cycling through CROSSWORD_PUZZLES in order, based on
// how many puzzles they've already played) if they don't have one going.
async function getOrCreateCurrentRound(supabaseAdmin, nickname) {
  const { data: latest, error: latestError } = await supabaseAdmin
    .from("crossword_rounds")
    .select("*")
    .eq("nickname", nickname)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestError) throw latestError;

  if (latest && latest.status === "playing") return latest;

  const { count, error: countError } = await supabaseAdmin
    .from("crossword_rounds")
    .select("id", { count: "exact", head: true })
    .eq("nickname", nickname);
  if (countError) throw countError;

  const nextIndex = (count || 0) % CROSSWORD_PUZZLES.length;

  const { data: created, error } = await supabaseAdmin
    .from("crossword_rounds")
    .insert({ nickname, puzzle_index: nextIndex, revealed_cells: [] })
    .select()
    .single();

  if (error) throw error;
  return created;
}

async function getLeaderboard(supabaseAdmin) {
  const { data } = await supabaseAdmin
    .from("crossword_scores")
    .select("nickname, points, puzzles_solved")
    .order("points", { ascending: false })
    .limit(10);
  return data || [];
}

function publicRoundState(round) {
  const puzzle = CROSSWORD_PUZZLES[round.puzzle_index];
  return {
    roundId: round.id,
    size: puzzle.size,
    blocks: puzzle.blocks,
    entries: puzzle.entries.map(({ number, direction, row, col, answer, clue }) => ({
      number,
      direction,
      row,
      col,
      length: answer.length,
      clue,
    })),
    revealedCells: round.revealed_cells,
    status: round.status,
  };
}

// GET /api/crossword?nickname=... — that player's current puzzle (started
// if they don't have one yet) + the top-10 leaderboard. Without a
// nickname, just the leaderboard comes back so the page can show it
// before anyone's started playing. Public, no login.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const nickname = (searchParams.get("nickname") || "").trim().slice(0, MAX_NICKNAME_LENGTH);
  const supabaseAdmin = getSupabaseAdmin();
  let stage = "start";
  try {
    stage = "leaderboard";
    const leaderboard = await getLeaderboard(supabaseAdmin);
    if (!nickname) {
      return NextResponse.json({ leaderboard }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    stage = "getOrCreateCurrentRound";
    const round = await getOrCreateCurrentRound(supabaseAdmin, nickname);
    stage = "publicRoundState";
    if (!CROSSWORD_PUZZLES[round.puzzle_index]) {
      throw new Error(`No puzzle at index ${round.puzzle_index} (round ${round.id}, nickname ${nickname})`);
    }
    return NextResponse.json(
      { ...publicRoundState(round), leaderboard },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    // Log the real error server-side (visible in your terminal / Vercel
    // logs) but never hand a raw exception message back to a player —
    // that's confusing at best and can leak internals at worst.
    console.error(`[api/crossword] stage=${stage}`, err);
    return NextResponse.json({ error: "Something went wrong on our end. Try again in a moment." }, { status: 500 });
  }
}

// POST /api/crossword { row, col, letter, nickname }
// Public, no login. One cell guess per call, applied to that nickname's
// own in-progress round. A wrong guess isn't persisted at all — it's just
// graded and handed back.
export async function POST(req) {
  const limited = checkRateLimit(req, "crossword");
  if (limited) return limited;

  const { row, col, letter, nickname } = await req.json();

  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return NextResponse.json({ error: "Invalid cell" }, { status: 400 });
  }
  if (typeof letter !== "string" || !/^[a-zA-Z]$/.test(letter)) {
    return NextResponse.json({ error: "Guess a single letter" }, { status: 400 });
  }
  const trimmedNickname = typeof nickname === "string" ? nickname.trim().slice(0, MAX_NICKNAME_LENGTH) : "";
  if (!trimmedNickname) {
    return NextResponse.json({ error: "Enter a nickname first" }, { status: 400 });
  }

  const normalizedLetter = letter.toLowerCase();
  const supabaseAdmin = getSupabaseAdmin();

  // Tracks which step we're on so that if something throws, the server log
  // says exactly where — production stack traces point into a minified,
  // single-line bundle (e.g. "route.js:1:5010") that's otherwise useless
  // for pinning down which line actually failed.
  let stage = "start";

  try {
    stage = "getOrCreateCurrentRound";
    const round = await getOrCreateCurrentRound(supabaseAdmin, trimmedNickname);

    stage = "load puzzle";
    const puzzle = CROSSWORD_PUZZLES[round.puzzle_index];
    if (!puzzle) {
      throw new Error(`No puzzle at index ${round.puzzle_index} (round ${round.id}, nickname ${trimmedNickname})`);
    }

    stage = "bounds/block check";
    if (row < 0 || row >= puzzle.size || col < 0 || col >= puzzle.size || isBlock(puzzle, row, col)) {
      return NextResponse.json({ error: "That's not a playable cell" }, { status: 400 });
    }

    stage = "already-finished check";
    if (round.status !== "playing") {
      const leaderboard = await getLeaderboard(supabaseAdmin);
      return NextResponse.json({ ...publicRoundState(round), leaderboard });
    }

    stage = "already-revealed check";
    const revealedSoFar = Array.isArray(round.revealed_cells) ? round.revealed_cells : [];
    const alreadyRevealed = revealedSoFar.find((cell) => cell.row === row && cell.col === col);
    if (alreadyRevealed) {
      const leaderboard = await getLeaderboard(supabaseAdmin);
      return NextResponse.json({ ...publicRoundState(round), leaderboard, correct: alreadyRevealed.letter === normalizedLetter });
    }

    stage = "solvedGridFor";
    const solvedGrid = solvedGridFor(round.puzzle_index);
    const solvedRow = solvedGrid[row];
    if (!solvedRow || solvedRow[col] === undefined) {
      // Shouldn't happen — the bounds/block check above should have
      // already rejected this cell — but fail with a clear message
      // instead of a raw index crash if the grid and puzzle ever
      // disagree (e.g. a future puzzle added with a typo'd shape).
      throw new Error(`No answer letter defined for row ${row}, col ${col} in puzzle ${round.puzzle_index}`);
    }
    const correct = solvedRow[col] === normalizedLetter;

    if (!correct) {
      stage = "wrong-guess leaderboard";
      const leaderboard = await getLeaderboard(supabaseAdmin);
      return NextResponse.json({ ...publicRoundState(round), leaderboard, correct: false });
    }

    stage = "update round";
    const revealedCells = [...revealedSoFar, { row, col, letter: normalizedLetter }];
    const solved = revealedCells.length >= totalFillableCells(puzzle);
    const status = solved ? "solved" : "playing";

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("crossword_rounds")
      .update({
        revealed_cells: revealedCells,
        status,
        finished_at: solved ? new Date().toISOString() : null,
      })
      .eq("id", round.id)
      .select()
      .single();

    if (updateError) throw updateError;

    stage = "score lookup";
    const points = CELL_POINTS + (solved ? SOLVE_BONUS : 0);
    const { data: existing, error: scoreLookupError } = await supabaseAdmin
      .from("crossword_scores")
      .select("*")
      .eq("nickname", trimmedNickname)
      .maybeSingle();
    if (scoreLookupError) throw scoreLookupError;

    stage = "score update/insert";
    if (existing) {
      const { error: scoreUpdateError } = await supabaseAdmin
        .from("crossword_scores")
        .update({
          points: existing.points + points,
          puzzles_solved: existing.puzzles_solved + (solved ? 1 : 0),
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
      if (scoreUpdateError) throw scoreUpdateError;
    } else {
      const { error: scoreInsertError } = await supabaseAdmin.from("crossword_scores").insert({
        nickname: trimmedNickname,
        points,
        puzzles_solved: solved ? 1 : 0,
      });
      if (scoreInsertError) throw scoreInsertError;
    }

    stage = "final leaderboard";
    const leaderboard = await getLeaderboard(supabaseAdmin);
    return NextResponse.json({ ...publicRoundState(updated), leaderboard, correct: true });
  } catch (err) {
    // Log the real error server-side (visible in your terminal / Vercel
    // logs) but never hand a raw exception message back to a player —
    // that's confusing at best and can leak internals at worst.
    console.error(`[api/crossword] stage=${stage}`, err);
    return NextResponse.json({ error: "Something went wrong on our end. Try again in a moment." }, { status: 500 });
  }
}
