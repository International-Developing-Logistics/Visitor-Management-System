import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { HANGMAN_WORDS } from "@/lib/hangmanWords";

const MAX_WRONG = 6;
const MAX_NICKNAME_LENGTH = 30;

// Each player has their own private round — not a shared board — so their
// score is entirely their own. A round belongs to a nickname; fetches the
// player's current in-progress round, or starts their next one (cycling
// through HANGMAN_WORDS in order, based on how many rounds they've already
// played) if they don't have one going. Both GET and POST funnel through
// this, so it's the one place "what's this player's word" gets decided.
async function getOrCreateCurrentRound(supabaseAdmin, nickname) {
  const { data: latest } = await supabaseAdmin
    .from("hangman_rounds")
    .select("*")
    .eq("nickname", nickname)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest && latest.status === "playing") return latest;

  const { count } = await supabaseAdmin
    .from("hangman_rounds")
    .select("id", { count: "exact", head: true })
    .eq("nickname", nickname);

  const nextIndex = (count || 0) % HANGMAN_WORDS.length;
  const word = HANGMAN_WORDS[nextIndex];

  const { data: created, error } = await supabaseAdmin
    .from("hangman_rounds")
    .insert({ nickname, word_index: nextIndex, word, max_wrong: MAX_WRONG })
    .select()
    .single();

  if (error) throw error;
  return created;
}

function maskWord(word, guessedLetters) {
  return word.split("").map((letter) => (guessedLetters.includes(letter) ? letter : null));
}

async function getLeaderboard(supabaseAdmin) {
  const { data } = await supabaseAdmin
    .from("hangman_scores")
    .select("nickname, points, rounds_won")
    .order("points", { ascending: false })
    .limit(10);
  return data || [];
}

function publicRoundState(round) {
  const finished = round.status !== "playing";
  return {
    roundId: round.id,
    wordLength: round.word.length,
    maskedWord: maskWord(round.word, round.guessed_letters),
    guessedLetters: round.guessed_letters,
    wrongGuesses: round.wrong_guesses,
    maxWrong: round.max_wrong,
    status: round.status,
    ...(finished ? { word: round.word } : {}),
  };
}

// GET /api/hangman?nickname=... — that player's current round (started if
// they don't have one yet) + the top-10 leaderboard. Without a nickname,
// just the leaderboard comes back so the page can show it before anyone's
// started playing. Public, no login.
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const nickname = (searchParams.get("nickname") || "").trim().slice(0, MAX_NICKNAME_LENGTH);
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const leaderboard = await getLeaderboard(supabaseAdmin);
    if (!nickname) {
      return NextResponse.json({ leaderboard }, { headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    const round = await getOrCreateCurrentRound(supabaseAdmin, nickname);
    return NextResponse.json(
      { ...publicRoundState(round), leaderboard },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/hangman { letter: string, nickname: string }
// Public, no login. One letter guess per call, applied to that nickname's
// own in-progress round.
export async function POST(req) {
  const limited = checkRateLimit(req, "hangman");
  if (limited) return limited;

  const { letter, nickname } = await req.json();

  if (typeof letter !== "string" || !/^[a-zA-Z]$/.test(letter)) {
    return NextResponse.json({ error: "Guess a single letter" }, { status: 400 });
  }
  const trimmedNickname = typeof nickname === "string" ? nickname.trim().slice(0, MAX_NICKNAME_LENGTH) : "";
  if (!trimmedNickname) {
    return NextResponse.json({ error: "Enter a nickname first" }, { status: 400 });
  }

  const normalizedLetter = letter.toLowerCase();
  const supabaseAdmin = getSupabaseAdmin();

  try {
    const round = await getOrCreateCurrentRound(supabaseAdmin, trimmedNickname);

    if (round.status !== "playing") {
      // This round already finished (e.g. a second tab caught up) — hand
      // back the finished state instead of erroring.
      const leaderboard = await getLeaderboard(supabaseAdmin);
      return NextResponse.json({ ...publicRoundState(round), leaderboard });
    }

    if (round.guessed_letters.includes(normalizedLetter)) {
      return NextResponse.json({ error: "That letter's already been guessed" }, { status: 400 });
    }

    const guessedLetters = [...round.guessed_letters, normalizedLetter];
    const correct = round.word.includes(normalizedLetter);
    const wrongGuesses = correct ? round.wrong_guesses : round.wrong_guesses + 1;
    const solved = round.word.split("").every((l) => guessedLetters.includes(l));
    const failed = !solved && wrongGuesses >= round.max_wrong;
    const status = solved ? "won" : failed ? "lost" : "playing";

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("hangman_rounds")
      .update({
        guessed_letters: guessedLetters,
        wrong_guesses: wrongGuesses,
        status,
        finished_at: status === "playing" ? null : new Date().toISOString(),
      })
      .eq("id", round.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Scoring: +1 for any correct letter guess, +6 bonus for finishing
    // the word. Since this round is this player's alone, every point
    // earned in it is entirely down to their own guesses.
    if (correct) {
      const points = 1 + (solved ? 6 : 0);
      const { data: existing } = await supabaseAdmin
        .from("hangman_scores")
        .select("*")
        .eq("nickname", trimmedNickname)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from("hangman_scores")
          .update({
            points: existing.points + points,
            rounds_won: existing.rounds_won + (solved ? 1 : 0),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabaseAdmin.from("hangman_scores").insert({
          nickname: trimmedNickname,
          points,
          rounds_won: solved ? 1 : 0,
        });
      }
    }

    const leaderboard = await getLeaderboard(supabaseAdmin);
    return NextResponse.json({ ...publicRoundState(updated), leaderboard });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
