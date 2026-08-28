// Shared "what's your name" convenience for the fun/games pages
// (components/HangmanGame.jsx, components/CrosswordGame.jsx). Not an
// account or any kind of identity check — just a client-side label so a
// shared leaderboard has something to show. Stored under one key so a
// nickname typed into one game carries over to the other.
const NICKNAME_KEY = "office-games:nickname";
const MAX_NICKNAME_LENGTH = 30;

export function loadNickname() {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(NICKNAME_KEY) || "";
  } catch {
    return "";
  }
}

export function saveNickname(name) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NICKNAME_KEY, name.slice(0, MAX_NICKNAME_LENGTH));
  } catch {
    // best-effort — worst case you retype your name next visit
  }
}

export { MAX_NICKNAME_LENGTH };
