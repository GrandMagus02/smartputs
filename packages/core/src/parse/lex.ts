import type { Decimal } from "../decimal";
import { numberSymbols, parseNumber } from "../locale/number";
import type { Keyword, Locale, OpSymbol } from "../types";

export type Token =
  | { type: "number"; value: Decimal; text: string; start: number; end: number }
  | { type: "word"; text: string; start: number; end: number }
  | { type: "op"; op: OpSymbol; start: number; end: number }
  | { type: "keyword"; keyword: Keyword; start: number; end: number }
  | { type: "lparen"; start: number; end: number }
  | { type: "rparen"; start: number; end: number };

const OPS: Record<string, OpSymbol> = { "+": "+", "-": "-", "*": "*", "/": "/" };

function defaultSegment(run: string, localeId: string): string[] {
  const segmenter = new Intl.Segmenter(localeId, { granularity: "word" });
  return [...segmenter.segment(run)].filter((s) => s.isWordLike).map((s) => s.segment);
}

function keywordFor(word: string, locale: Locale): Keyword | null {
  for (const [keyword, aliases] of Object.entries(locale.keywords)) {
    if (aliases?.includes(word)) return keyword as Keyword;
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
      const run = input.slice(start, i);
      const words = locale.segment ? locale.segment(run) : defaultSegment(run, locale.id);
      let offset = start;
      for (const word of words) {
        const at = input.indexOf(word, offset);
        const wordStart = at === -1 ? offset : at;
        const wordEnd = wordStart + word.length;
        const keyword = keywordFor(word, locale);
        tokens.push(
          keyword === null
            ? { type: "word", text: word, start: wordStart, end: wordEnd }
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
