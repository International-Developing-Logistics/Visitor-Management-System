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
