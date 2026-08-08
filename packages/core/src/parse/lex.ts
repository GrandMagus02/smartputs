import type { Decimal } from "../decimal";
import { buildKeywords } from "../locale/compose";
import { numberSymbols, parseNumber } from "../locale/number";
import type { Keyword, LiteralReading, Locale, OpSymbol, WordPosition } from "../types";

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

/**
 * Single-character operators, by the character typed. The right-hand side is
 * the canonical spelling, so three ways of writing multiplication collapse to
 * one `OpSymbol` and nothing downstream — `pratt.ts`'s `BINDING`, the
 * evaluator's signature tables, `print.ts`'s `OP_KEYWORDS` — grows a second
 * name for one operation. Written as escapes because U+00B7 is visually
 * confusable with "." and U+22C5 with both: a reader has to be able to tell
 * from the source which character is in the table.
 *
 * The SI multiplication sign is arithmetic here, not a unit character, and the
 * case that settled it is Ukrainian energy. `energy:kwh` has symbol "кВт·год",
 * so a Ukrainian engine prints "2кВт·год" and — before this line — could not
 * read its own output: "·" fell through to the unrecognized-character path,
 * "кВт" and "год" arrived adjacent with nothing between them, and the parse
 * failed outright. With "·" lexed as `*` the printed symbol is an expression:
 * kilowatt × hour, which `@smartput/energy`'s `* | power | duration` signature
 * already answers, the same signature that makes "2 kw * 3 h" work. That is
 * the mechanism English has always used for "m/s" — `speed:mps`'s symbol is
 * not an alias either, it re-reads because the lexer splits on "/" and length
 * ÷ duration computes to a speed — so this is that rule extended to the other
 * SI operator, not a second mechanism beside it.
 *
 * Listing "·" as a *unit* character instead (`UNIT_SYMBOLS`, or a compound
 * alias) is the road not taken: it would make "кВт·год" a single opaque word
 * that every kind writing a product symbol has to register by hand, while the
 * arithmetic reading costs nothing per kind and gets "Н·м", "кг·м/с²" and
 * anything else composed of registered units for free.
 *
 * Three spellings because a keyboard, a spec sheet and a TeX-derived document
 * produce three different characters for the one sign, and a user pasting from
 * any of them means multiply:
 *   - U+00B7 MIDDLE DOT — the SI form, and the character the "кВт·год"
 *     named above is actually written with.
 *   - U+00D7 MULTIPLICATION SIGN — the school-arithmetic and datasheet form
 *     ("1920 × 1080").
 *   - U+22C5 DOT OPERATOR — Unicode's mathematical dot, what LaTeX's `\cdot`
 *     and most math typesetting emit.
 *
 * Three groups are deliberately left out. U+2062 INVISIBLE TIMES is zero-width,
 * so accepting it would make an input that looks like one word multiply — the
 * one case where "people type what their keyboard offers" argues the other way,
 * because nobody can see what they typed. U+2219 BULLET OPERATOR and U+2022
 * BULLET are list markers first; a bullet leading a line is far commoner than a
 * bullet meaning product, and reading one as `*` would turn a pasted list item
 * into arithmetic. U+2044 FRACTION SLASH and U+2215 DIVISION SLASH are the same
 * question on the division side and stay out for now on the same rule this
 * commit followed: add the spelling a symbol the repo already *emits* is written
 * with, and nothing speculative beside it.
 *
 * Exported for `testing/locale.ts`, which derives the character set from it:
 * that check has to tell a unit *word* from a printed *expression*, and this
 * table is what decides which is which. Only the binding is exported, not a
 * second constant built from it — a `new Set(...)` at this module's top level
 * survives bundling into every package that lexes, and `check-size` sees it.
 */
export const OPS: Record<string, OpSymbol> = {
  "+": "+",
  "-": "-",
  "*": "*",
  "/": "/",
  "\u00B7": "*",
  "\u00D7": "*",
  "\u22C5": "*",
};

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

/**
 * Every word token's run, keyed by the token itself: the maximal stretch of
 * word tokens with nothing but spaces between them, and each word's index in
 * it. `runOf` is the only reader.
 *
 * **Beside the token rather than on it**, and the parity net is what decided
 * it. `explain().tokens` hands a caller the token objects verbatim and the
 * corpus fixture records them field by field, so a `run` property on
 * `WordToken` is a *recorded public output*: adding one moved six fixture rows
 * with no behaviour behind the diff. The run is derived — every word in it is
 * already in the token list the caller can see — so paying a recorded output
 * for it would be paying for a restatement.
 *
 * Keyed on identity because identity is what survives the trip. `lex` knows
 * the run; `pratt` asks the resolver about a word three fold passes later, and
 * by then the array has been rebuilt twice, so a table keyed on index or span
 * would be reading someone else's entry. Every fold pushes an untouched token
 * through by reference (`literals.ts`, `numerals.ts`, `wordops.ts` each
 * `out.push(token)`), and a claim keeps its `fallback` the same way — which is
 * why "tokyo" under a city claim still finds the run it was written in.
 *
 * Weak because the entry is worth exactly as long as the token: a `Tokenizer`
 * is long-lived and lexes every keystroke, and a strong map would hold every
 * token of every input it ever saw.
 */
const RUNS = new WeakMap<WordToken, WordPosition>();

/**
 * The run of words `token` was written inside, if it had neighbours.
 *
 * `undefined` for a word standing alone, and that is a deliberate absence
 * rather than a singleton run: the analyzer chain already defaults to
 * `[surface]` at index 0, so recording it here would allocate a pair per token
 * to say what the default says, and — because the chain keys its memo on the
 * run whenever it is given one — would cost every single-word input the
 * one-entry-per-word cache it has today.
 */
export function runOf(token: Token): WordPosition | undefined {
  return token.type === "word" ? RUNS.get(token) : undefined;
}

/**
 * Record the run of every word token that has one.
 *
 * Two things a narrower rule would have missed, and one definition covers
 * both. A `segment` hook splits one letter chunk into several words — German
 * `Zentimeter`, a CJK run — and those arrive adjacent with no gap at all. A
 * phrase is written across spaces — "square metres" — and a rule that stopped
 * at the chunk boundary would leave a phrase analyzer with nothing to read,
 * since `lex` cuts a letter chunk at the first space long before segmentation
 * sees it. So the run is "what the writer wrote next to each other", not "what
 * one call to `segment` returned".
 *
 * The gap check is what keeps it honest. Anything else between two words — a
 * number, an operator, a keyword, a paren — is a different token type and ends
 * the run by falling out of the group. An *unrecognized* character is the case
 * only the gap check catches: `lex` skips it silently, so "kg@C" would
 * otherwise arrive as two adjacent words and read as a phrase nobody wrote.
 * `°` is **not** an example of this, though it is the unrecognized character
 * one reaches for first: `normalize()` deletes it several stages upstream, so
 * "kg°C" reaches `lex` as the single word "kgC" and there are no two words to
 * separate. The characters this catches are the ones normalization keeps —
 * "@", "~", every punctuation mark that is neither an operator nor a paren.
 *
 * Runs are recorded here, before the fold passes, so a token that a later fold
 * absorbs still counts as a neighbour of the ones that survive: the run is a
 * fact about what was typed, not about what the folds made of it. The one
 * visible consequence is that "twenty two kg" leaves `kg` with a three-word
 * run whose first two words became a single number token.
 */
function recordRuns(tokens: Token[], input: string): Token[] {
  let start = 0;
  while (start < tokens.length) {
    if (tokens[start]?.type !== "word") {
      start += 1;
      continue;
    }
    let end = start + 1;
    while (tokens[end]?.type === "word") {
      const gap = input.slice(
        (tokens[end - 1] as WordToken).end,
        (tokens[end] as WordToken).start,
      );
      if (gap.trim().length > 0) break;
      end += 1;
    }
    if (end - start > 1) {
      const group = tokens.slice(start, end) as WordToken[];
      const words = group.map((t) => t.text);
      for (const [index, token] of group.entries()) RUNS.set(token, { words, index });
    }
    start = end;
  }
  return tokens;
}

/**
 * @param locale The *format* locale: number grammar and segmentation belong to
 * the one language the engine speaks (I8), and so does the case fold below.
 * @param keywords Every installed language's connectives, folded by
 * `buildKeywords`. Optional, and defaulting to this locale's own table, so the
 * documented "compose the passes yourself" contract of `@smartput/core
 * /tokenize` keeps working with the one argument it always took — but an
 * engine passes the many-locale map, because reading two languages' units
 * while reading one language's connectives would leave "5 кг in grams"
 * readable and "5 кг в грамах" not.
 */
export function lex(
  input: string,
  locale: Locale,
  keywords: ReadonlyMap<string, Keyword> = buildKeywords([locale]),
): Token[] {
  const { group, decimal } = numberSymbols(locale.language);
  const tokens: Token[] = [];
  let i = 0;

  const isDigit = (c: string) => c >= "0" && c <= "9";
  const isLetter = (c: string) => /\p{L}/u.test(c);

  // `normalize()` folds every whitespace run to a plain space before `lex` runs,
  // so a language whose group separator is a *non-breaking* space never sees its
  // own separator here: Ukrainian groups with U+00A0 and French ICU with U+202F,
  // and by this point the formatter's own "2\u00A0000" has arrived as "2 000".
  // Accepting the folded form is what makes such a language's output re-readable
  // — without it `evaluate(evaluate("2 кг в грамах").formatted)` lexes two
  // numbers and throws, which is the gap `@smartput/datarate` and
  // `@smartput/tempo` each pinned while waiting for this.
  //
  // The lookahead is what keeps it from swallowing a word boundary: a group
  // separator is followed by exactly three digits, so "2 000 г" is one number
  // while "2 3 кг" stays two tokens. A language that declares a plain space as
  // its separator outright (`numberFormat: { group: " " }`) is left on the
  // unconditional branch below, where it already was.
  const groupFoldsToSpace = group !== " " && /\s/.test(group);
  const isFoldedGroup = (at: number) =>
    groupFoldsToSpace &&
    input[at] === " " &&
    isDigit(input[at + 1] ?? "") &&
    isDigit(input[at + 2] ?? "") &&
    isDigit(input[at + 3] ?? "") &&
    !isDigit(input[at + 4] ?? "");

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
        (isDigit(input[i] as string) ||
          input[i] === group ||
          input[i] === decimal ||
          isFoldedGroup(i))
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
        // Keywords match case-insensitively, like units do. The fold happens
        // here and not in normalize() on purpose: normalize() feeds every
        // kind, and later milestones (currency codes, hex colours) need the
        // raw case preserved. The map's keys are already folded, each under
        // its own contributing language's id — see `buildKeywords`.
        const keyword = keywords.get(text.toLocaleLowerCase(locale.id));
        tokens.push(
          keyword === undefined
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

  return recordRuns(tokens, input);
}
