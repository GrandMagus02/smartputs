import type { Locale } from "../types";
import type { Token } from "./lex";

/**
 * Longest cardinal the largest plausible table can express, so the cap bounds
 * the work per token without ever truncating a real number. Five scale groups
 * up to trillions, each "nine hundred and ninety nine" plus its scale word, is
 * 29 words. Rounded up for headroom.
 */
const MAX_RUN = 32;

interface Run {
  words: string[];
  /** `ends[k]` is the token index just past the k-th word, hyphens included. */
  ends: number[];
}

/**
 * Consecutive `word` tokens from `start`, hopping a hyphen that joins two of
 * them. `normalize()` maps every dash to "-" and the lexer emits that as an op,
 * so "twenty-two" arrives as word/op/word and would otherwise evaluate to 18.
 * Absorbing it only when nothing separates it from the words on either side is
 * what keeps "twenty - two" as subtraction; the spans make that test exact.
 */
function collectRun(tokens: Token[], start: number): Run {
  const words: string[] = [];
  const ends: number[] = [];
  let i = start;
  let prev: Token | undefined;

  while (i < tokens.length && words.length < MAX_RUN) {
    let cursor = i;
    const dash = tokens[cursor];

    if (
      prev !== undefined &&
      dash !== undefined &&
      dash.type === "op" &&
      dash.op === "-"
    ) {
      const after = tokens[cursor + 1];
      if (
        after === undefined ||
        after.type !== "word" ||
        prev.end !== dash.start ||
        dash.end !== after.start
      ) {
        break;
      }
      cursor += 1;
    }

    const token = tokens[cursor];
    if (token === undefined || token.type !== "word") break;

    words.push(token.text);
    i = cursor + 1;
    ends.push(i);
    prev = token;
  }

  return { words, ends };
}

export function foldNumerals(tokens: Token[], locale: Locale): Token[] {
  const numerals = locale.numerals;
  if (numerals === undefined) return tokens;

  const out: Token[] = [];
  let i = 0;

  while (i < tokens.length) {
    const token = tokens[i] as Token;

    if (token.type === "number") {
      const next = tokens[i + 1];
      if (next !== undefined && next.type === "word") {
        const match = numerals([next.text]);
        // Only a bare scale word may attach to digits, so "1.5 million" reads
        // as one number while "5 one" stays two adjacent numbers the parser
        // refuses. Identifying the scale word by value rather than by table is
        // what keeps this pass locale-agnostic: no other one-word cardinal
        // reaches 100.
        if (match !== null && match.consumed === 1 && match.value.gte(100)) {
          out.push({
            type: "number",
            value: token.value.times(match.value),
            text: `${token.text} ${next.text}`,
            start: token.start,
            end: next.end,
          });
          i += 2;
          continue;
        }
      }
      out.push(token);
      i += 1;
      continue;
    }

    if (token.type === "word") {
      const run = collectRun(tokens, i);
      const match = run.words.length === 0 ? null : numerals(run.words);
      if (match !== null && match.consumed > 0 && match.consumed <= run.words.length) {
        const end = run.ends[match.consumed - 1] as number;
        const last = tokens[end - 1] as Token;
        out.push({
          type: "number",
          value: match.value,
          // Informational only — `explain()` reads it, the parser reads `value`.
          // Joined rather than sliced because the pass never sees the input.
          text: run.words.slice(0, match.consumed).join(" "),
          start: token.start,
          end: last.end,
        });
        i = end;
        continue;
      }
    }

    out.push(token);
    i += 1;
  }

  return out;
}
