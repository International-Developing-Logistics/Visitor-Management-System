// Word list for the shared Hangman game (see app/api/hangman/route.js and
// components/HangmanGame.jsx). This is a placeholder starter list —
// swap it for your own any time.
//
// HOW TO EDIT:
//   - Just add, remove, or reorder strings below. Letters only (a-z),
//     any length works, lowercase (the UI upper-cases for display).
//   - The list is played in order, looping back to the start after the
//     last word — no need to keep it a fixed length.
//   - No redeploy caveats beyond the normal ones for this app (push to
//     Vercel / restart `npm run dev`) — there's nothing else to configure.
//
// The current round always keeps its place by index (see
// hangman_rounds.word_index in supabase/migration_hangman_game.sql), so
// inserting or removing words does shift which word comes "next" — that's
// fine, it just reshuffles the remaining rotation, nothing breaks.
export const HANGMAN_WORDS = [
  "forklift",
  "pallet",
  "warehouse",
  "shipment",
  "delivery",
  "inventory",
  "container",
  "logistics",
  "freight",
  "trailer",
  "cargo",
  "supplier",
  "customer",
  "contractor",
  "visitor",
  "reception",
  "security",
  "checkpoint",
  "badge",
  "kiosk",
  "tablet",
  "vehicle",
  "equipment",
  "facility",
  "schedule",
  "document",
  "invoice",
  "manager",
  "office",
  "parking",
  "entrance",
  "elevator",
  "hallway",
  "cafeteria",
  "meeting",
  "printer",
  "keyboard",
  "monitor",
  "network",
  "password",
];
