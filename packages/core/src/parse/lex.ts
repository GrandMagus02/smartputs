import type { Decimal } from "../decimal";
import { numberSymbols, parseNumber } from "../locale/number";
import type { Keyword, KindId, Locale, OpSymbol } from "../types";

export type Token =
  | { type: "number"; value: Decimal; text: string; start: number; end: number }
  | { type: "word"; text: string; start: number; end: number }
  | { type: "op"; op: OpSymbol; start: number; end: number }
  | { type: "keyword"; keyword: Keyword; start: number; end: number }
  | { type: "lparen"; start: number; end: number }
  | { type: "rparen"; start: number; end: number }
  // Produced only by foldLiterals, never by lex(): a kind claimed this run of
  // source and already built the value it stands for.
  | {
      type: "literal";
      kind: KindId;
      unit: string;
      canonical: Decimal;
      meta?: Readonly<Record<string, unknown>>;
      weight: number;
      /** Carries `LiteralMatch.targetable` through to the parser. */
      targetable?: boolean;
      text: string;
      start: number;
      end: number;
    };

const OPS: Record<string, OpSymbol> = { "+": "+", "-": "-", "*": "*", "/": "/" };

// Unit symbols that are not letters and not arithmetic ops still need to
// reach the resolver as a word so a kind's lexicon can claim them — "%" is
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
  for (const [keyword, aliases] of Object.entries(locale.keywords)) {
    if (aliases?.some((a) => a.toLocaleLowerCase(locale.id) === folded)) {
      return keyword as Keyword;
    }
  }
  return null;
}

export function lex(input: string, locale: Locale): Token[] {
  const { group, decimal } = numberSymbols(locale);
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
      const value = parseNumber(text, locale);
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
      const words = locale.segment ? locale.segment(run) : defaultSegment(run, locale.id);
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
