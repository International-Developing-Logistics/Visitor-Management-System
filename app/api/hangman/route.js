import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseClient";
import { checkRateLimit } from "@/lib/rateLimit";
import { HANGMAN_WORDS } from "@/lib/hangmanWords";

const MAX_WRONG = 6;
const MAX_NICKNAME_LENGTH = 30;

// Fetches the most recent round, or starts the next one (cycling through
// HANGMAN_WORDS in order) if there isn't one yet or the last one already
// finished. This is the one place "what's the current word" gets decided,
// so both GET and POST funnel through it.
async function getOrCreateCurrentRound(supabaseAdmin) {
  const { data: latest } = await supabaseAdmin
    .from("hangman_rounds")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latest && latest.status === "playing") return latest;

  const nextIndex = latest ? (latest.word_index + 1) % HANGMAN_WORDS.length : 0;
  const word = HANGMAN_WORDS[nextIndex % HANGMAN_WORDS.length];

  const { data: created, error } = await supabaseAdmin
    .from("hangman_rounds")
    .insert({ word_index: nextIndex, word, max_wrong: MAX_WRONG })
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
    winningNickname: round.winning_nickname,
    ...(finished ? { word: round.word } : {}),
  };
}

// GET /api/hangman — current shared round + top-10 leaderboard. Public.
export async function GET() {
  const supabaseAdmin = getSupabaseAdmin();
  try {
    const round = await getOrCreateCurrentRound(supabaseAdmin);
    const leaderboard = await getLeaderboard(supabaseAdmin);
    return NextResponse.json(
      { ...publicRoundState(round), leaderboard },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/hangman { letter: string, nickname: string }
// Public, no login — this is a for-fun shared feature. One letter guess
// per call, applied to whichever round is currently in progress.
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
    const round = await getOrCreateCurrentRound(supabaseAdmin);

    if (round.status !== "playing") {
      // Someone else's guess just finished the round between this
      // player's page load and their click — hand back the finished
      // state instead of erroring, so the client can just re-render.
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
        winning_nickname: solved ? trimmedNickname : round.winning_nickname,
        finished_at: status === "playing" ? null : new Date().toISOString(),
      })
      .eq("id", round.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Scoring: +1 for any correct letter guess, +5 bonus for whoever
    // guesses the letter that completes the word. No points for a wrong
    // guess or for guessing after the round's already over.
    if (correct) {
      const points = solved ? 6 : 1;
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
