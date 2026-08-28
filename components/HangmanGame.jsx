"use client";

import { useCallback, useEffect, useState } from "react";
import BrandHeader from "@/components/BrandHeader";
import { loadNickname, saveNickname } from "@/lib/nickname";

const LETTERS = "abcdefghijklmnopqrstuvwxyz".split("");

function HangmanFigure({ wrongGuesses }) {
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

export default function HangmanGame() {
  const [nickname, setNickname] = useState("");
  const [activeNickname, setActiveNickname] = useState(null); // whose round is loaded
  const [state, setState] = useState(null); // GET /api/hangman response
  const [message, setMessage] = useState("");
  const [guessing, setGuessing] = useState(false);

  useEffect(() => {
    const saved = loadNickname();
    setNickname(saved);
    if (saved) setActiveNickname(saved); // returning player — jump straight in
  }, []);

  const load = useCallback(async (nick) => {
    try {
      const qs = nick ? `?nickname=${encodeURIComponent(nick)}` : "";
      const res = await fetch(`/api/hangman${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState(data);
    } catch {
      setMessage("Couldn't load the game. Try refreshing.");
    }
  }, []);

  useEffect(() => {
    load(activeNickname);
  }, [activeNickname, load]);

  const startPlaying = () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setMessage("Enter your name");
      return;
    }
    setMessage("");
    setActiveNickname(trimmed);
  };

  const guess = useCallback(
    async (letter) => {
      if (!state || !state.roundId || state.status !== "playing" || guessing) return;
      if (state.guessedLetters.includes(letter)) return;
      setGuessing(true);
      setMessage("");
      try {
        const res = await fetch("/api/hangman", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ letter, nickname: activeNickname }),
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
    [state, activeNickname, guessing]
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Ignore keystrokes typed into a form field (e.g. the nickname
      // input) — otherwise every letter typed there was also being sent
      // to the server as a real letter guess.
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) return;
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

  const finished = state?.roundId && state.status !== "playing";
  const playing = !!activeNickname;

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Hangman" />
      </div>

      <div className="card" style={{ textAlign: "center" }}>
        <h3 style={{ marginBottom: 4 }}>Hangman 🎪</h3>
        <p className="helper-text" style={{ marginBottom: 18 }}>
          Guess the staff if you can
        </p>

        {!playing && (
          <>
            <label htmlFor="hg-nickname" style={{ display: "block", textAlign: "left", maxWidth: 260, margin: "0 auto" }}>
              Your name
            </label>
            <input
              id="hg-nickname"
              type="text"
              value={nickname}
              onChange={handleNicknameChange}
              onKeyDown={(e) => e.key === "Enter" && startPlaying()}
              placeholder="e.g. bakri"
              style={{ maxWidth: 260, margin: "0 auto 12px" }}
            />
            {message && <p className="error-text">{message}</p>}
            <button className="btn btn-primary" onClick={startPlaying}>
              Start playing
            </button>
          </>
        )}

        {playing && !state?.roundId && <p className="helper-text">Loading…</p>}

        {playing && state?.roundId && (
          <>
            <p className="helper-text" style={{ marginBottom: 14 }}>
              Playing as <strong>{activeNickname}</strong> ·{" "}
              <button
                onClick={() => setActiveNickname(null)}
                style={{ background: "none", border: "none", color: "var(--muted)", fontSize: "inherit", cursor: "pointer", textDecoration: "underline", padding: 0 }}
              >
                switch player
              </button>
            </p>

            <HangmanFigure wrongGuesses={state.wrongGuesses} />
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
                🎉 Ayyy good job! You got it in {state.wrongGuesses} wrong guess{state.wrongGuesses === 1 ? "" : "es"}!
              </p>
            )}
            {state.status === "lost" && (
              <p style={{ fontWeight: 600, color: "var(--danger)" }}>
                Bakri! the word was <span style={{ textTransform: "uppercase" }}>{state.word}</span>.
              </p>
            )}

            {finished && (
              <button className="btn btn-primary" onClick={() => load(activeNickname)} style={{ marginTop: 4 }}>
                Play again
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
