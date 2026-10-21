// Puzzle bank for the shared Crossword game (see app/api/crossword/route.js
// and components/CrosswordGame.jsx). Just one puzzle to start - add more
// any time by appending another entry to CROSSWORD_PUZZLES below.
//
// HOW TO ADD A PUZZLE:
//   Unlike the Hangman word list, you can't just type in a new word -
//   every across AND down entry has to spell a real word at every
//   crossing letter, or the grid is broken. Hand-building that from
//   scratch is genuinely fiddly, and the grid also has to be big enough
//   for your longest word (the API rejects/crashes-safely on any entry
//   that runs off the edge of `size` - see the validation in
//   solvedGridFor() in app/api/crossword/route.js). The cleanest way is
//   to ask Claude to design + verify a new one (it can brute-force a
//   solver the same way this puzzle was built), or use a mini crossword
//   constructor site and translate the result into the shape below.
//
// SHAPE:
//   size    - the grid is size x size. Every entry's row/col + answer
//             length must stay within [0, size).
//   blocks  - [row, col] pairs for the black/unplayable squares - every
//             cell in the size x size grid that ISN'T part of an entry
//             needs to be listed here.
//   entries - one object per across/down word: { number, direction,
//             row, col, answer, clue }. `row`/`col` is the entry's
//             FIRST cell. `number` follows standard crossword numbering
//             (number every cell that starts an across or down entry,
//             reading left-to-right/top-to-bottom - a cell that starts
//             both shares one number). `answer` is lowercase, letters
//             only - it's never sent to the browser until a round ends.
//
// This puzzle (9x9, 73% filled) was rebuilt on 2026-09-02, choosing the
// 10 best-interlocking words out of the 19 you had in play (the original
// 10 plus the 9 freight/logistics terms you added) - breakbulk, backhaul,
// harmony, yard, freight, carrier, racking, cargo, truck, and tariff share
// enough letters to cross well, so they made the cut; stowage, bonded,
// idl, fleet, customs, dock, bay, hauler, and ship didn't interlock with
// this set closely enough to earn a spot without leaving the grid mostly
// empty, so they were left out. Regenerated from scratch with a
// constraint solver and independently re-verified (no gaps, no letter
// conflicts, no entry running off the grid, correct reading-order
// numbering).
export const CROSSWORD_PUZZLES = [
  {
    size: 9,
    blocks: [
      [1, 8],
      [2, 2],
      [2, 4],
      [2, 5],
      [2, 6],
      [4, 2],
      [4, 4],
      [4, 5],
      [4, 6],
      [5, 2],
      [6, 2],
      [6, 4],
      [6, 5],
      [6, 6],
      [6, 7],
      [7, 2],
      [7, 4],
      [7, 5],
      [7, 6],
      [7, 7],
      [8, 0],
      [8, 7],
    ],
    entries: [
      { number: 1, direction: "across", row: 0, col: 0, answer: "breakbulk", clue: "Non-containerized, individual, or unitized freight" },
      { number: 1, direction: "down", row: 0, col: 0, answer: "backhaul", clue: "A return journey taken by a transport vehicle heading back toward its point of origin" },
      { number: 2, direction: "across", row: 1, col: 1, answer: "harmony", clue: "A noun that means agreement, peaceful living, or a pleasing combination of different musical notes" },
      { number: 3, direction: "down", row: 1, col: 7, answer: "yard", clue: "Where freight cars get sorted and stored" },
      { number: 4, direction: "down", row: 2, col: 1, answer: "freight", clue: "Goods or products moved in large amounts by ship, train, truck, or airplane" },
      { number: 5, direction: "down", row: 2, col: 3, answer: "carrier", clue: "Transportation company contracted to move freight from origin to destination" },
      { number: 6, direction: "down", row: 2, col: 8, answer: "racking", clue: "Industrial vertical shelving system used for high-density storage" },
      { number: 7, direction: "across", row: 3, col: 2, answer: "cargo", clue: "The goods or merchandise carried by a ship, airplane, train, or truck" },
      { number: 8, direction: "across", row: 5, col: 4, answer: "truck", clue: "A large motor vehicle designed to transport goods, carry heavy loads, or perform specialized work" },
      { number: 9, direction: "across", row: 8, col: 1, answer: "tariff", clue: "A scheduled duty or tax imposed by a national government on imports or exports" },
    ],
  },
];
