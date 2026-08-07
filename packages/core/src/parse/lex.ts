import type { Decimal } from "../decimal";
import { numberSymbols, parseNumber } from "../locale/number";
import type { Keyword, LiteralReading, Locale, OpSymbol } from "../types";

export interface NumberToken {
  type: "number";
  value: Decimal;
  text: string;
  start: number;
  end: number;
}

export interface WordToken {
  type: "word";
  text: string;
  start: number;
  end: number;
}

export type Token =
  | NumberToken
  | WordToken
  | { type: "op"; op: OpSymbol; start: number; end: number }
  | { type: "keyword"; keyword: Keyword; start: number; end: number }
  | { type: "lparen"; start: number; end: number }
  | { type: "rparen"; start: number; end: number }
  // Produced only by foldLiterals, never by lex(): one or more kinds claimed
  // this run of source and already built the values it stands for.
  | {
      type: "literal";
      /**
       * Every reading of this span, in the order the fold collected them — by
       * kind id, then by the order the matcher listed its own. Never empty, and
       * carrying more than one is the whole point: the runner-up Athens has to
       * survive as far as the solver to be rankable against anything.
       */
      readings: readonly LiteralReading[];
      /**
       * The single source token this claim covered, when it covered exactly
       * one. The claim is a reading of that token, not a replacement for it, so
       * the ordinary reading — 90210 the number, "tokyo" the time zone — stays
       * reachable and the fold stops being destructive.
       *
       * Absent for a multi-token claim: "new york" and "2026-01-15" have no
       * single token underneath to fall back to, and reconstituting one would
       * mean un-lexing the claim.
       */
      fallback?: NumberToken | WordToken;
      text: string;
      start: number;
      end: number;
    };

const OPS: Record<string, OpSymbol> = { "+": "+", "-": "-", "*": "*", "/": "/" };

/**
 * Comparison operators, longest first, because `>=` must be tried before `>`.
 *
 * The right-hand side is the *canonical* spelling: `==` and `<>` fold into `=`
 * and `!=` here, so nothing downstream ever sees a second name for one
 * operation and no signature table has to carry duplicate keys. The three
 * single-character mathematical forms are accepted for the same reason the
 * normalizer unifies four dashes — people type what their keyboard offers.
 */
const COMPARISONS: ReadonlyArray<readonly [string, OpSymbol]> = [
  [">=", ">="],
  ["<=", "<="],
  ["!=", "!="],
  ["<>", "!="],
  ["==", "="],
  ["≥", ">="],
  ["≤", "<="],
  ["≠", "!="],
  [">", ">"],
  ["<", "<"],
  ["=", "="],
];

// Unit symbols that are not letters and not arithmetic ops still need to
// reach the resolver as a word so a vocabulary can claim them — "%" is
// the M2 case, and M3's currency symbols ($, €, £, ...) are expected to add
// entries here. This is an explicit allowlist, not a general "any symbol
// character becomes a word" rule, because a general rule would break "20 °C":
// "°" falls through the same unrecognized-character path below today, and
// that is exactly what makes "°C" resolve as the single unit alias "C" — if
// "°" became its own word token, "C" would still resolve but "°" would not,
// and a general rule has no way to know that "°" should stay silent while
// "%" should not. The principled general answer is threading the registry's
// alias index into the lexer so any registered symbol alias lexes
// automatically without either list; that was judged out of scope for M2.
const UNIT_SYMBOLS = new Set(["%"]);

function defaultSegment(run: string, localeId: string): string[] {
  const segmenter = new Intl.Segmenter(localeId, { granularity: "word" });
  return [...segmenter.segment(run)].filter((s) => s.isWordLike).map((s) => s.segment);
}

function keywordFor(word: string, locale: Locale): Keyword | null {
  // Keywords match case-insensitively, like units do. The fold happens here and
  // not in normalize() on purpose: normalize() feeds every kind, and later
  // milestones (currency codes, hex colours) need the raw case preserved.
  const folded = word.toLocaleLowerCase(locale.id);
  for (const [keyword, aliases] of Object.entries(locale.language.keywords)) {
    if (aliases?.some((a) => a.toLocaleLowerCase(locale.id) === folded)) {
      return keyword as Keyword;
    }
  }
  return null;
}

export function lex(input: string, locale: Locale): Token[] {
  const { group, decimal } = numberSymbols(locale.language);
  const tokens: Token[] = [];
  let i = 0;

  const isDigit = (c: string) => c >= "0" && c <= "9";
  const isLetter = (c: string) => /\p{L}/u.test(c);

  while (i < input.length) {
    const ch = input[i] as string;

    if (ch === " ") {
      i += 1;
      continue;
    }

    if (ch === "(") {
      tokens.push({ type: "lparen", start: i, end: i + 1 });
      i += 1;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", start: i, end: i + 1 });
      i += 1;
      continue;
    }

    // Before the single-character table, so `>=` is one token rather than `>`
    // followed by an unrecognized `=`.
    const comparison = COMPARISONS.find(([text]) => input.startsWith(text, i));
    if (comparison !== undefined) {
      const [text, op] = comparison;
      tokens.push({ type: "op", op, start: i, end: i + text.length });
      i += text.length;
      continue;
    }

    const op = OPS[ch];
    if (op !== undefined) {
      tokens.push({ type: "op", op, start: i, end: i + 1 });
      i += 1;
      continue;
    }

    if (UNIT_SYMBOLS.has(ch)) {
      tokens.push({ type: "word", text: ch, start: i, end: i + 1 });
      i += 1;
      continue;
    }

    if (isDigit(ch)) {
      const start = i;
      while (
        i < input.length &&
        (isDigit(input[i] as string) || input[i] === group || input[i] === decimal)
      ) {
        i += 1;
      }
      // A trailing group/decimal symbol is punctuation, not part of the number.
      while (i > start && !isDigit(input[i - 1] as string)) i -= 1;
      const text = input.slice(start, i);
      const value = parseNumber(text, locale.language);
      if (value === null) {
        i = start + 1;
        continue;
      }
      tokens.push({ type: "number", value, text, start, end: i });
      continue;
    }

    if (isLetter(ch)) {
      const start = i;
      while (i < input.length && isLetter(input[i] as string)) i += 1;
      const letterEnd = i;
      // A unit alias may end in digits -- M2 registers m2, cm2, km2 and m3.
      // Without absorbing that suffix the run lexes as a word followed by a
      // number, which no unit can claim, so those four aliases were
      // unreachable through the parser: "1 m2" threw UnitParseError while
      // "1 sqm" evaluated. Segmentation still runs over the letters alone --
      // Intl.Segmenter would keep "m2" whole, but a locale `segment` hook
      // returning substrings of its input cannot be asked to.
      while (i < input.length && isDigit(input[i] as string)) i += 1;
      const digits = input.slice(letterEnd, i);
      const run = input.slice(start, letterEnd);
      const words = locale.language.segment
        ? locale.language.segment(run)
        : defaultSegment(run, locale.id);
      let offset = start;
      for (const [index, word] of words.entries()) {
        const at = input.indexOf(word, offset);
        const wordStart = at === -1 ? offset : at;
        // The digits belong to the final word of the run and nowhere else.
        const text = index === words.length - 1 ? word + digits : word;
        const wordEnd = wordStart + text.length;
        const keyword = keywordFor(text, locale);
        tokens.push(
          keyword === null
            ? { type: "word", text, start: wordStart, end: wordEnd }
            : { type: "keyword", keyword, start: wordStart, end: wordEnd },
        );
        offset = wordEnd;
      }
      continue;
    }

    // Unrecognized character: skip it rather than fail the whole parse.
    i += 1;
  }

  return tokens;
}
