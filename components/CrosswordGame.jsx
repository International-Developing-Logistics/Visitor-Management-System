"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import BrandHeader from "@/components/BrandHeader";
import { loadNickname, saveNickname } from "@/lib/nickname";

function entryCells(entry) {
  const [dr, dc] = entry.direction === "across" ? [0, 1] : [1, 0];
  return Array.from({ length: entry.length }, (_, i) => [entry.row + dr * i, entry.col + dc * i]);
}

export default function CrosswordGame() {
  const [nickname, setNickname] = useState("");
  const [activeNickname, setActiveNickname] = useState(null); // whose round is loaded
  const [state, setState] = useState(null); // GET /api/crossword response
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState(null); // { row, col, direction }
  const [wrongCell, setWrongCell] = useState(null); // { row, col } — brief "not quite" flash
  const pendingCells = useRef(new Set());
  const wrongTimeout = useRef(null);

  useEffect(() => {
    const saved = loadNickname();
    setNickname(saved);
    if (saved) setActiveNickname(saved); // returning player — jump straight in
  }, []);

  const load = useCallback(async (nick) => {
    try {
      const qs = nick ? `?nickname=${encodeURIComponent(nick)}` : "";
      const res = await fetch(`/api/crossword${qs}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setState(data);
      setSelected(null);
    } catch {
      setMessage("Couldn't load the puzzle. Try refreshing.");
    }
  }, []);

  useEffect(() => {
    load(activeNickname);
  }, [activeNickname, load]);

  const startPlaying = () => {
    const trimmed = nickname.trim();
    if (!trimmed) {
      setMessage("Enter a nickname to start.");
      return;
    }
    setMessage("");
    setActiveNickname(trimmed);
  };

  // Index every cell by which across/down entry (if any) covers it, and
  // which entry (if any) starts there — built once per puzzle load.
  const cellIndex = useMemo(() => {
    if (!state?.entries) return {};
    const map = {};
    for (const entry of state.entries) {
      entryCells(entry).forEach(([r, c], i) => {
        const key = `${r},${c}`;
        if (!map[key]) map[key] = { across: null, down: null, number: null };
        map[key][entry.direction] = entry;
        if (i === 0) map[key].number = entry.number;
      });
    }
    return map;
  }, [state?.entries]);

  const revealedMap = useMemo(() => {
    const map = {};
    for (const cell of state?.revealedCells || []) map[`${cell.row},${cell.col}`] = cell.letter;
    return map;
  }, [state?.revealedCells]);

  const isBlock = useCallback(
    (row, col) => state?.blocks?.some(([r, c]) => r === row && c === col),
    [state?.blocks]
  );

  // Pick a sensible starting selection once a puzzle loads.
  useEffect(() => {
    if (state?.roundId && state.entries && !selected) {
      const first = [...state.entries].sort((a, b) => a.number - b.number || (a.direction === "across" ? -1 : 1))[0];
      if (first) setSelected({ row: first.row, col: first.col, direction: first.direction });
    }
  }, [state, selected]);

  const currentEntry = selected ? cellIndex[`${selected.row},${selected.col}`]?.[selected.direction] : null;

  const selectCell = (row, col) => {
    if (isBlock(row, col)) return;
    const entries = cellIndex[`${row},${col}`];
    if (!entries) return;
    setSelected((prev) => {
      if (prev && prev.row === row && prev.col === col) {
        const other = prev.direction === "across" ? "down" : "across";
        if (entries[other]) return { row, col, direction: other };
        return prev;
      }
      const direction = entries[prev?.direction] ? prev.direction : entries.across ? "across" : "down";
      return { row, col, direction };
    });
  };

  const moveWithin = (entry, row, col, delta) => {
    const cells = entryCells(entry);
    const idx = cells.findIndex(([r, c]) => r === row && c === col);
    const next = cells[idx + delta];
    if (next) setSelected({ row: next[0], col: next[1], direction: entry.direction });
  };

  const submitLetter = useCallback(
    async (row, col, letter, entry) => {
      const key = `${row},${col}`;
      if (revealedMap[key]) {
        if (entry) moveWithin(entry, row, col, 1);
        return;
      }
      if (pendingCells.current.has(key)) return;
      pendingCells.current.add(key);
      setMessage("");
      try {
        const res = await fetch("/api/crossword", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ row, col, letter, nickname: activeNickname }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessage(data.error || "Something went wrong");
          return;
        }
        setState(data);
        if (data.correct) {
          if (entry) moveWithin(entry, row, col, 1);
        } else {
          setWrongCell({ row, col });
          clearTimeout(wrongTimeout.current);
          wrongTimeout.current = setTimeout(() => setWrongCell(null), 600);
        }
      } catch {
        setMessage("Couldn't reach the server. Check your connection and try again.");
      } finally {
        pendingCells.current.delete(key);
      }
    },
    [activeNickname, revealedMap]
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target?.isContentEditable) return;
      if (!selected || !state?.roundId || state.status !== "playing") return;

      const key = e.key.toLowerCase();
      if (/^[a-z]$/.test(key)) {
        e.preventDefault();
        submitLetter(selected.row, selected.col, key, currentEntry);
        return;
      }
      if (e.key === "Backspace") {
        e.preventDefault();
        if (currentEntry) moveWithin(currentEntry, selected.row, selected.col, -1);
        return;
      }
      const arrowMap = { ArrowRight: [0, 1, "across"], ArrowLeft: [0, -1, "across"], ArrowDown: [1, 0, "down"], ArrowUp: [-1, 0, "down"] };
      if (arrowMap[e.key]) {
        e.preventDefault();
        const [dr, dc, dir] = arrowMap[e.key];
        let r = selected.row + dr;
        let c = selected.col + dc;
        while (r >= 0 && r < state.size && c >= 0 && c < state.size && isBlock(r, c)) {
          r += dr;
          c += dc;
        }
        if (r >= 0 && r < state.size && c >= 0 && c < state.size && !isBlock(r, c)) {
          const entries = cellIndex[`${r},${c}`];
          const direction = entries?.[dir] ? dir : entries?.across ? "across" : "down";
          setSelected({ row: r, col: c, direction });
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected, currentEntry, state, isBlock, cellIndex, submitLetter]);

  const handleNicknameChange = (e) => {
    const value = e.target.value.slice(0, 30);
    setNickname(value);
    saveNickname(value);
  };

  const playing = !!activeNickname;
  const solved = state?.roundId && state.status === "solved";
  const acrossClues = state?.entries?.filter((e) => e.direction === "across").sort((a, b) => a.number - b.number) || [];
  const downClues = state?.entries?.filter((e) => e.direction === "down").sort((a, b) => a.number - b.number) || [];

  const currentEntryCellKeys = useMemo(() => {
    if (!currentEntry) return new Set();
    return new Set(entryCells(currentEntry).map(([r, c]) => `${r},${c}`));
  }, [currentEntry]);

  return (
    <main className="kiosk-shell">
      <div className="kiosk-header">
        <BrandHeader label="Crossword" />
      </div>

      <div className="card" style={{ textAlign: "center" }}>
        <h3 style={{ marginBottom: 4 }}>Crossword 📝</h3>
        <p className="helper-text" style={{ marginBottom: 18 }}>
          Have fun!
        </p>

        {!playing && (
          <>
            <label htmlFor="cw-nickname" style={{ display: "block", textAlign: "left", maxWidth: 260, margin: "0 auto" }}>
              Your name
            </label>
            <input
              id="cw-nickname"
              type="text"
              value={nickname}
              onChange={handleNicknameChange}
              onKeyDown={(e) => e.key === "Enter" && startPlaying()}
              placeholder="e.g. Sam from Receiving"
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

            <div
              style={{
                display: "inline-grid",
                gridTemplateColumns: `repeat(${state.size}, 40px)`,
                gridTemplateRows: `repeat(${state.size}, 40px)`,
                gap: 3,
                margin: "0 auto 8px",
              }}
            >
              {Array.from({ length: state.size }, (_, r) =>
                Array.from({ length: state.size }, (_, c) => {
                  const key = `${r},${c}`;
                  if (isBlock(r, c)) {
                    return <div key={key} style={{ width: 40, height: 40, background: "var(--ink)", borderRadius: 4 }} />;
                  }
                  const letter = revealedMap[key];
                  const number = cellIndex[key]?.number;
                  const isSelected = selected?.row === r && selected?.col === c;
                  const inCurrentEntry = currentEntryCellKeys.has(key);
                  const isWrong = wrongCell?.row === r && wrongCell?.col === c;
                  return (
                    <button
                      key={key}
                      onClick={() => selectCell(r, c)}
                      style={{
                        position: "relative",
                        width: 40,
                        height: 40,
                        border: `2px solid ${isSelected ? "var(--accent-dark)" : isWrong ? "var(--danger)" : "var(--line)"}`,
                        borderRadius: 4,
                        background: isSelected ? "var(--accent-soft)" : inCurrentEntry ? "#f1f4ef" : "white",
                        fontWeight: 700,
                        fontSize: "1rem",
                        textTransform: "uppercase",
                        color: "var(--ink)",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      {number && (
                        <span style={{ position: "absolute", top: 1, left: 3, fontSize: "0.55rem", fontWeight: 400, color: "var(--muted)" }}>
                          {number}
                        </span>
                      )}
                      {letter || ""}
                    </button>
                  );
                })
              )}
            </div>

            {message && <p className="error-text">{message}</p>}

            {solved && (
              <p style={{ fontWeight: 600, color: "var(--accent-dark)", marginTop: 10 }}>
                Solved🎉 Nice work.
              </p>
            )}
            {solved && (
              <button className="btn btn-primary" onClick={() => load(activeNickname)} style={{ marginTop: 4 }}>
                Play next puzzle
              </button>
            )}

            <div style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", marginTop: 20, textAlign: "left" }}>
              <div style={{ minWidth: 160 }}>
                <p className="helper-text" style={{ marginTop: 0, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em" }}>
                  Across
                </p>
                {acrossClues.map((entry) => (
                  <p
                    key={`a${entry.number}`}
                    className="helper-text"
                    style={{
                      marginTop: 0,
                      marginBottom: 6,
                      cursor: "pointer",
                      fontWeight: currentEntry === entry ? 700 : 400,
                      color: currentEntry === entry ? "var(--accent-dark)" : "var(--muted)",
                    }}
                    onClick={() => setSelected({ row: entry.row, col: entry.col, direction: "across" })}
                  >
                    {entry.number}. {entry.clue}
                  </p>
                ))}
              </div>
              <div style={{ minWidth: 160 }}>
                <p className="helper-text" style={{ marginTop: 0, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", fontSize: "0.72rem", letterSpacing: "0.03em" }}>
                  Down
                </p>
                {downClues.map((entry) => (
                  <p
                    key={`d${entry.number}`}
                    className="helper-text"
                    style={{
                      marginTop: 0,
                      marginBottom: 6,
                      cursor: "pointer",
                      fontWeight: currentEntry === entry ? 700 : 400,
                      color: currentEntry === entry ? "var(--accent-dark)" : "var(--muted)",
                    }}
                    onClick={() => setSelected({ row: entry.row, col: entry.col, direction: "down" })}
                  >
                    {entry.number}. {entry.clue}
                  </p>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {state?.leaderboard?.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3 style={{ marginBottom: 4 }}>Top scorers</h3>
          <p className="helper-text" style={{ marginBottom: 14 }}>
            +1 per correct cell, +6 for finishing the puzzle.
          </p>
          <div className="vtable-scroll">
            <table className="vtable">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Points</th>
                  <th>Puzzles solved</th>
                </tr>
              </thead>
              <tbody>
                {state.leaderboard.map((row) => (
                  <tr key={row.nickname}>
                    <td style={{ fontWeight: 600 }}>{row.nickname}</td>
                    <td>{row.points}</td>
                    <td>{row.puzzles_solved}</td>
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
