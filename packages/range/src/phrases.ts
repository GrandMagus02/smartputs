import { numberFromWords } from "@smartput/number";
import { assertOrdered, type Slice, ZeroIndexError } from "./slice";

/**
 * Where a written position 1 lands in the stored, zero-based slice.
 *
 * `1` is the default and the only setting a person ever means: "from 6 to 9"
 * counts items the way a person counts them, so the sixth item is `5`. `0`
 * turns the translation off for an embedder feeding the parser positions that
 * are already indices — a REPL over an array, a picker over rows it numbered
 * itself — and is the one setting under which `ZeroIndexError` is unreachable.
 */
export type Origin = 0 | 1;

export interface ParseOptions {
  origin?: Origin;
}

/** A claim over `input`, and how much of it was consumed. */
export interface Claim {
  slice: Slice;
  /**
   * Characters a literal matcher may claim, counted from the offered offset.
   * Always > 0, and never more than `consumed`.
   *
   * The two differ only for an interval closed with `]`. Core's lexer drops
   * `[`, `]` and `;` as unrecognized characters, and `foldLiterals` discards any
   * claim that does not end exactly where some token ends — so a claim running
   * through a `]` ends in a place no token reaches and is thrown away whole.
   * `length` therefore stops at the last digit, leaving the bracket to be
   * dropped by the lexer as it always was.
   */
  length: number;
  /**
   * Characters the grammar actually read, counted from the offered offset. What
   * `parseSlice` measures full coverage against, because a standalone caller
   * has no token stream and every character of their string has to be accounted
   * for.
   */
  consumed: number;
}

/** How a counting phrase turns a count into two positions. */
export type Anchor = (count: number) => Slice;

const DEFAULT_ORIGIN: Origin = 1;

/**
 * A written position translated into a stored one.
 *
 * Negatives pass through untouched at either origin. "-2" already counts from
 * the end, where there is no off-by-one to correct: the last item is the last
 * item whether a person starts counting at one or at zero, and shifting it
 * would make "from -3 to -1" select four things.
 */
export function toPosition(written: number, origin: Origin, input: string): number {
  if (written < 0) return written;
  if (written === 0 && origin === 1) throw new ZeroIndexError(input);
  return written - origin;
}

/**
 * `[1,5]`, `(1;5]`, `[2, -1)` — a closed or open interval over positions.
 *
 * Both separators are accepted because both are written. A comma is the English
 * convention and a semicolon the one most of continental Europe learns, for the
 * reason that decimal commas make `(1,5)` ambiguous there; this parser reads
 * integers only, so it has no such ambiguity to resolve and no reason to refuse
 * either spelling.
 *
 * An open end moves **inwards** by one written position before the origin is
 * applied, which is what makes `(1;5]` and `[2;5]` the same selection. Doing it
 * in written space rather than in stored space is what keeps a negative open end
 * correct: `[1,-1)` excludes the last item and stops at `-2`, and an adjustment
 * applied after the origin shift would have moved a positive end twice.
 */
const BODY = /^\s*([+-]?\d+)\s*[,;]\s*([+-]?\d+)\s*([\])])/;

/**
 * Finds the opening bracket, which is not always at the offered offset.
 *
 * `(` lexes as an lparen, so a claim over `(1;5]` is offered offset 0 and reads
 * the bracket under its own feet. `[` lexes as nothing at all — it is an
 * unrecognized character the lexer skips — so the first token of `[1,5]` is the
 * number, and the claim is offered the offset *after* the bracket. Looking one
 * character behind is the only way the second form is reachable at all, and it
 * costs nothing: an offset whose preceding character is `[` is not a position
 * any other grammar here starts at.
 */
function openingBracket(
  input: string,
  offset: number,
): { open: string; body: number } | null {
  const here = input[offset];
  if (here === "(" || here === "[") return { open: here, body: offset + 1 };
  let back = offset - 1;
  while (back >= 0 && input[back] === " ") back -= 1;
  return input[back] === "[" ? { open: "[", body: offset } : null;
}

function interval(input: string, offset: number, origin: Origin): Claim | null {
  const bracket = openingBracket(input, offset);
  if (bracket === null) return null;
  const match = BODY.exec(input.slice(bracket.body));
  if (match === null) return null;

  const upperText = match[2] as string;
  const lower = Number(match[1]) + (bracket.open === "(" ? 1 : 0);
  const upper = Number(upperText) - (match[3] === ")" ? 1 : 0);
  const slice = {
    start: toPosition(lower, origin, input),
    end: toPosition(upper, origin, input),
  };
  assertOrdered(input, slice);

  const consumed = bracket.body + match[0].length - offset;
  // A `)` lexes as an rparen and so is a token boundary a claim may end on; a
  // `]` is not, and neither is the whitespace that may sit in front of it, so
  // the claimable end is the end of the last digit.
  const length =
    match[3] === ")"
      ? consumed
      : bracket.body + match[0].lastIndexOf(upperText) + upperText.length - offset;
  return { slice, length, consumed };
}

/**
 * Which end of the list a counting phrase counts from, and where it puts a
 * count of `n`.
 *
 * "top"/"bottom" sit here rather than in a table of their own because they are
 * the same two selections under the names a ranked list gives them, and an
 * embedder who wants only one vocabulary replaces the table with `phrases`.
 *
 * Deliberately **no ordinal words**. "second" is a `duration` alias in every
 * locale pack this repo ships, so claiming it here would put a selection reading
 * on the right of "3 seconds" for the solver to weigh — the same reason
 * `date-range` refuses to claim a bare "week". Positions are written as numbers
 * or not at all.
 */
export const ANCHORS: Readonly<Record<string, Anchor>> = Object.freeze({
  first: (n: number) => ({ start: 0, end: n - 1 }),
  top: (n: number) => ({ start: 0, end: n - 1 }),
  last: (n: number) => ({ start: -n, end: -1 }),
  bottom: (n: number) => ({ start: -n, end: -1 }),
});

/** The anchor word at the head of `rest`, if the head is a word at all. */
const HEAD = /^[a-z]+/;

/**
 * Offsets of the first `count` whitespace-separated words of `text`.
 *
 * Returns the end offset of the last of them, so a claim is measured against
 * the text as typed rather than against a re-joined copy of it. Re-joining is
 * what a `split(/\s+/).slice(0, n).join(" ").length` would measure, and it is
 * off by one character for every doubled space in the input.
 */
function endOfWords(text: string, count: number): number | null {
  let offset = 0;
  for (let seen = 0; seen < count; seen++) {
    const gap = /^\s*/.exec(text.slice(offset))?.[0].length ?? 0;
    const word = /^\S+/.exec(text.slice(offset + gap))?.[0];
    if (word === undefined) return null;
    offset += gap + word.length;
  }
  return offset;
}

/**
 * `first three`, `last 2`, `top 5`, and the bare `first` / `last`.
 *
 * A bare anchor is a count of one, which is the reading that makes "last" mean
 * the last item rather than nothing. It claims only its own four letters, so a
 * longer phrase built on the same word — `date-range`'s "last week" — still wins
 * the fold on length and this claim never reaches the solver at all.
 *
 * The count may be spelled. `numberFromWords` is `@smartput/number`'s, so "one
 * hundred and five" reads the same here as it does in a quantity; a second table
 * of cardinals is a table that drifts.
 */
function anchored(
  rest: string,
  phrases: Readonly<Record<string, Anchor>>,
  input: string,
): Claim | null {
  const head = HEAD.exec(rest.toLowerCase())?.[0];
  if (head === undefined) return null;
  const build = phrases[head];
  if (build === undefined) return null;

  const bare: Claim = { slice: build(1), length: head.length, consumed: head.length };
  const tail = rest.slice(head.length);
  if (!/^\s/.test(tail)) return bare;

  const words = tail.trimStart().split(/\s+/);
  const count = numberFromWords(words);
  // A count has to be a whole number of items. "first 2.5" claims only "first",
  // leaving the 2.5 to be read as the number it is, which is the same thing
  // that happens to "first week".
  if (count === null || !/^[1-9]\d*$/.test(count.text)) return bare;

  const consumed = endOfWords(tail, count.consumed);
  if (consumed === null) return bare;
  const slice = build(Number(count.text));
  assertOrdered(input, slice);
  const claimed = head.length + consumed;
  return { slice, length: claimed, consumed: claimed };
}

const OPENERS = ["from "] as const;
/** Written closers, safe to claim anywhere: none of them is an operator. */
const WORD_CLOSERS = [
  " to ",
  " until ",
  " till ",
  " through ",
  "...",
  "..",
  "…",
] as const;
/** The two that collide with subtraction. Withheld from the engine's matcher. */
const DASH_CLOSERS = ["-", "–", "—"] as const;

/**
 * The two written positions in `from A to B`, or null when this is not that.
 *
 * `A` has to be consumed **whole**, for the reason `datetime-range`'s
 * `fromToAt` gives: a start that read only part of its segment would leave text
 * inside the claimed span that nothing interpreted, and "from noise 6 to 9"
 * would silently become 6-to-9, noise and all.
 *
 * Earliest closer wins, longest at a tie — so "1...5" is read with "..." rather
 * than as ".." with a stray dot after it — and a closer at offset 0 is no closer
 * at all, which is what keeps the minus sign of "-3 to -1" out of the running.
 */
function endpoints(
  text: string,
  closers: readonly string[],
): { from: number; to: number; length: number } | null {
  const lower = text.toLowerCase();
  let cut: { index: number; closer: string } | null = null;
  for (const closer of closers) {
    const index = lower.indexOf(closer);
    if (index <= 0) continue;
    const better =
      cut === null ||
      index < cut.index ||
      (index === cut.index && closer.length > cut.closer.length);
    if (better) cut = { index, closer };
  }
  if (cut === null) return null;

  const left = text.slice(0, cut.index).trim();
  if (!/^[+-]?\d+$/.test(left)) return null;
  const right = /^\s*([+-]?\d+)/.exec(text.slice(cut.index + cut.closer.length));
  if (right === null) return null;

  return {
    from: Number(left),
    to: Number(right[1]),
    length: cut.index + cut.closer.length + right[0].length,
  };
}

/**
 * `from A to B`, and — only when `closers` includes the dash — the bare `A - B`.
 *
 * The split happens before either end is read, which for this grammar is a
 * convenience rather than the necessity it is next door in `datetime-range`;
 * keeping the shape identical is what lets the two be compared at all.
 */
function fromTo(
  rest: string,
  origin: Origin,
  input: string,
  closers: readonly string[],
): Claim | null {
  const lower = rest.toLowerCase();
  const opener = OPENERS.find((word) => lower.startsWith(word));
  const body = opener === undefined ? rest : rest.slice(opener.length);
  const pair = endpoints(body, closers);
  if (pair === null) return null;

  const slice = {
    start: toPosition(pair.from, origin, input),
    end: toPosition(pair.to, origin, input),
  };
  assertOrdered(input, slice);
  const claimed = (opener?.length ?? 0) + pair.length;
  return { slice, length: claimed, consumed: claimed };
}

export interface ClaimOptions extends ParseOptions {
  /**
   * Whether a bare `A - B` may be claimed here. False inside the engine, where
   * the dash is an **op signature** rather than a literal claim: `foldLiterals`
   * is destructive for a multi-token claim, so a matcher spanning "4 - 5" would
   * delete the subtraction reading before the solver ever weighed it, and the
   * whole point of `dashWeight` is that the two readings compete. True for the
   * standalone parser, which has no solver to compete in.
   */
  dash?: boolean;
  /** Replaces the default anchor table. */
  phrases?: Readonly<Record<string, Anchor>>;
}

/**
 * The longest claim starting at `offset`, or null.
 *
 * Longest rather than first, because the three grammars overlap on text that
 * starts the same way and only one of them is what the user typed. The fold
 * would prefer the longer claim anyway; deciding it here means the shorter one
 * is never offered.
 */
export function claimAt(
  input: string,
  offset: number,
  opts: ClaimOptions = {},
): Claim | null {
  const origin = opts.origin ?? DEFAULT_ORIGIN;
  const phrases = opts.phrases ?? ANCHORS;
  const closers =
    opts.dash === true ? [...WORD_CLOSERS, ...DASH_CLOSERS] : [...WORD_CLOSERS];
  const rest = input.slice(offset);

  let best: Claim | null = null;
  for (const claim of [
    interval(input, offset, origin),
    anchored(rest, phrases, input),
    fromTo(rest, origin, input, closers),
  ]) {
    if (claim !== null && (best === null || claim.length > best.length)) best = claim;
  }
  return best;
}

/**
 * The whole string as one selection, or null when it is not one.
 *
 * This is the standalone door — `Range.parse` and nothing else in the engine —
 * so it accepts the bare dash form that `claimAt` withholds from the matcher,
 * and it insists the claim cover the **entire** input. A partial claim is what
 * the engine's fold is for; a caller asking "is this string a selection?" wants
 * yes or no, not "the first four characters were".
 */
export function parseSlice(text: string, opts: ParseOptions = {}): Slice | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const claim = claimAt(trimmed, 0, { ...opts, dash: true });
  return claim !== null && claim.consumed === trimmed.length ? claim.slice : null;
}
