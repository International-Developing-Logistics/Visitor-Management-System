"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import BrandHeader from "@/components/BrandHeader";

const POLL_MS = 4000; // keep everyone's board in sync while a round is live
const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");
const NICKNAME_KEY = "hangman:nickname";

function HangmanFigure({ wrongGuesses, maxWrong }) {
  // Six stages: head, body, left arm, right arm, left leg, right leg —
  // matches the default maxWrong of 6 from the API.
  const show = (n) => wrongGuesses >= n;
  return (
    <svg width="140" height="160" viewBox="0 0 140 160" style={{ margin: "0 auto", display: "block" }}>
      {/* gallows */}
      <line x1="10" y1="150" x2="90" y2="150" stroke="var(--muted)" strokeWidth="4" strokeLinecap="round" />
      <line x1="30" y1="150" x2="30" y2="15" stroke="var(--muted)" strokeWidth="4" strokeLinecap="round" />
      <line x1="30" y1="15" x2="95" y2="15" stroke="var(--muted)" strokeWidth="4" strokeLinecap="round" />
      <line x1="95" y1="15" x2="95" y2="32" stroke="var(--muted)" strokeWidth="4" strokeLinecap="round" />

      {show(1) && <circle cx="95" cy="46" r="14" fill="none" stroke="var(--danger)" strokeWidth="4" />}
      {show(2) && <line x1="95" y1="60" x2="95" y2="100" stroke="var(--danger)" strokeWidth="4" strokeLinecap="round" />}
      {show(3) && <line x1="95" y1="70" x2="78" y2="88" stroke="var(--danger)" strokeWidth="4" strokeLinecap="round" />}
      {show(4) && <line x1="95" y1="70" x2="112" y2="88" stroke="var(--danger)" strokeWidth="4" strokeLinecap="round" />}
      {show(5) && <line x1="95" y1="100" x2="80" y2="130" stroke="var(--danger)" strokeWidth="4" strokeLinecap="round" />}
      {show(6) && <line x1="95" y1="100" x2="110" y2="130" stroke="var(--danger)" strokeWidth="4" strokeLinecap="round" />}
    </svg>
  );
}

function loadNickname() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NICKNAME_KEY) || "";
  } catch {
    return "";
  }
}

function saveNickname(name) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NICKNAME_KEY, name);
  } catch {
    // best-effort — worst case you retype your name next visit
  }
}

export default function HangmanGame() {
  const [state, setState] = useState(null); // GET /api/hangman response
  const [nickname, setNickname] = useState("");
  const [message, setMessage] = useState("");
  const [guessing, setGuessing] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    setNickname(loadNickname());
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/hangman");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState(data);
    } catch {
      setMessage("Couldn't load the game. Try refreshing.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while a round is actually in progress, so everyone watching sees
  // colleagues' guesses land without a manual refresh — same pattern
  // GuardStation uses for its live tables.
  useEffect(() => {
    clearInterval(pollRef.current);
    if (state?.status === "playing") {
      pollRef.current = setInterval(load, POLL_MS);
    }
    return () => clearInterval(pollRef.current);
  }, [state?.status, load]);

  const guess = useCallback(
    async (letter) => {
      if (!state || state.status !== "playing" || guessing) return;
      if (state.guessedLetters.includes(letter)) return;
      if (!nickname.trim()) {
        setMessage("Enter a name for the leaderboard");
        return;
      }
      setGuessing(true);
      setMessage("");
      try {
        const res = await fetch("/api/hangman", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ letter, nickname: nickname.trim() }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error || "Something went wrong");
          return;
        }
        setState(data);
      } catch {
        setMessage("Couldn't reach the server. Check your connection and try again.");
      } finally {
        setGuessing(false);
      }
    },
    [state, nickname, guessing]
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (/^[a-z]$/.test(key)) guess(key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [guess]);

  const handleNicknameChange = (e) => {
    const value = e.target.value.slice(0, 30);
    setNickname(value);
    saveNickname(value);
  };

  const finished = state && state.status !== "playing";

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Hangman" />
      </div>

      <div className="card" style={{ textAlign: "center" }}>
        <h3 style={{ marginBottom: 4 }}>Hangman 🎪</h3>
        <p className="helper-text" style={{ marginBottom: 18 }}>
          Guess the staff
        </p>

        {!state && <p className="helper-text">Loading…</p>}

        {state && (
          <>
            <label htmlFor="hg-nickname" style={{ display: "block", textAlign: "left", maxWidth: 260, margin: "0 auto" }}>
              Your nickname
            </label>
            <input
              id="hg-nickname"
              type="text"
              value={nickname}
              onChange={handleNicknameChange}
              placeholder="e.g. Sam from Receiving"
              style={{ maxWidth: 260, margin: "0 auto 14px" }}
            />

            <HangmanFigure wrongGuesses={state.wrongGuesses} maxWrong={state.maxWrong} />
            <p className="helper-text" style={{ marginTop: 4 }}>
              {state.wrongGuesses}/{state.maxWrong} wrong guesses
            </p>

            <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap", margin: "16px 0" }}>
              {state.maskedWord.map((letter, i) => (
                <div
                  key={i}
                  style={{
                    width: 34,
                    height: 42,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    textTransform: "uppercase",
                    borderBottom: "3px solid var(--muted)",
                    color: "var(--ink)",
                  }}
                >
                  {letter || ""}
                </div>
              ))}
            </div>

            {message && <p className="error-text">{message}</p>}

            {state.status === "won" && (
              <p style={{ fontWeight: 600, color: "var(--accent-dark)" }}>
                🎉 {state.winningNickname} Good job you know everyone's names  <span style={{ textTransform: "uppercase" }}>{state.word}</span>.
              </p>
            )}
            {state.status === "lost" && (
              <p style={{ fontWeight: 600, color: "var(--danger)" }}>
                haha you lose <span style={{ textTransform: "uppercase" }}>{state.word}</span>.
              </p>
            )}

            {finished && (
              <button className="btn btn-primary" onClick={load} style={{ marginTop: 4 }}>
                Play next round
              </button>
            )}

            {!finished && (
              <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap", marginTop: 18, maxWidth: 380, marginLeft: "auto", marginRight: "auto" }}>
                {LETTERS.map((letter) => {
                  const guessed = state.guessedLetters.includes(letter);
                  const correct = guessed && state.maskedWord.includes(letter);
                  return (
                    <button
                      key={letter}
                      onClick={() => guess(letter)}
                      disabled={guessed || guessing}
                      style={{
                        width: 30,
                        height: 38,
                        border: "none",
                        borderRadius: 6,
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        textTransform: "uppercase",
                        cursor: guessed || guessing ? "not-allowed" : "pointer",
                        background: guessed ? (correct ? "var(--accent)" : "var(--muted)") : "var(--accent-soft)",
                        color: guessed ? "white" : "var(--accent-dark)",
                        opacity: guessed ? 0.85 : 1,
                      }}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {state?.leaderboard?.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3 style={{ marginBottom: 4 }}>Top scorers</h3>
          <p className="helper-text" style={{ marginBottom: 14 }}>
            +1 per correct letter, +6 for finishing the word.
          </p>
          <div className="vtable-scroll">
            <table className="vtable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Points</th>
                  <th>Rounds won</th>
                </tr>
              </thead>
              <tbody>
                {state.leaderboard.map((row) => (
                  <tr key={row.nickname}>
                    <td style={{ fontWeight: 600 }}>{row.nickname}</td>
                    <td>{row.points}</td>
                    <td>{row.rounds_won}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
