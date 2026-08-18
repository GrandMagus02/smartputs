import type { Decimal } from "../decimal";
import { buildKeywords } from "../locale/compose";
import { type Grammar, grammarsFor, parseNumber } from "../locale/number";
import type { Keyword, LiteralReading, Locale, OpSymbol, WordPosition } from "../types";

/**
 * One way the installed grammars read a digit run, and who reads it that way.
 *
 * `"1,5"` is fifteen to an English reader and one and a half to a German one;
 * both are evidence, and neither is a winner until the solver has weighed the
 * unit word beside it. So a reading is data with a provenance, exactly as a
 * unit `Candidate` is — ambiguity is weighted, never deleted.
 */
export interface NumberReading {
  readonly value: Decimal;
  /** Locale ids whose grammar produced this value. Sorted. */
  readonly locales: readonly string[];
}

export interface NumberToken {
  type: "number";
  /**
   * The format locale's reading, or the first one when no installed grammar of
   * the format locale accepted the run. Every existing reader of `.value` —
   * `coerce`, `validate`, the completer, the evaluator when nothing overrode
   * the slot — keeps the answer it had.
   */
  value: Decimal;
  /**
   * Every reading of this run, one per accepting grammar, deduplicated by
   * value. Length 1 for `"15"`, and for anything at all on a single-grammar
   * engine.
   *
   * Optional, and absent rather than defaulted, because `lex` is not the only
   * producer of a number token: `foldNumerals` builds one out of spelled words
   * ("twenty two"), where the claim *is* the reading and there is no run of
   * digits to scan. Absent means "one reading, the value above", which is what
   * a reader that ignores this field already assumes.
   */
  readings?: readonly NumberReading[];
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
 * What comes after position `from`, to the resolution ruling R-B1 needs: is
 * there anything at all, is it arithmetic, is it another `in`, or is it
 * something a conversion could target?
 *
 * A character scan rather than a lookahead over tokens, because at the point
 * R-B1 asks, the tokens after `from` do not exist yet — `lex` is one pass and
 * the question is about the input, not about a token list. Three of the four
 * answers are cheap and exact (end of input, an operator, a keyword spelled
 * `in`); everything else is `"other"`, which is the answer that keeps the
 * conversion reading, so the fallback is always the conservative one.
 *
 * Only a plain space is skipped, and that is enough: `normalize()` folds every
 * whitespace run to one before `lex` ever runs.
 */
function nextSignificant(
  input: string,
  from: number,
  keywords: ReadonlyMap<string, Keyword>,
  localeId: string,
): "end" | "op" | "in" | "other" {
  let at = from;
  while (input[at] === " ") at += 1;
  if (at >= input.length) return "end";
  const ch = input[at] as string;
  if (OPS[ch] !== undefined) return "op";
  if (COMPARISONS.some(([text]) => input.startsWith(text, at))) return "op";
  let end = at;
  while (end < input.length && /\p{L}/u.test(input[end] as string)) end += 1;
  const word = input.slice(at, end).toLocaleLowerCase(localeId);
  return keywords.get(word) === "in" ? "in" : "other";
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
 * @param grammars The distinct number grammars of the installed locales, from
 * `grammarsFor`. Defaults to this locale's own single grammar, so a caller who
 * composes the passes by hand lexes digits exactly as it did before grammars
 * existed. An engine passes every installed one, because reading digits is
 * many-locale for the same reason reading words is: a German number written
 * beside a German unit word was being read under English's grammar and
 * answered at full confidence.
 * @param isUnitAlias Whether some installed vocabulary spells a unit that way —
 * `MatchCtx.isUnitAlias`, the registry query the `Tokenizer` already builds for
 * the literal fold. Read only by ruling R-B1 below. Defaults to "nothing is a
 * unit", so every caller who composes the passes by hand keeps the lexing it
 * had: the re-lex is a capability an engine opts into by having a registry, not
 * a change to what three arguments mean.
 */
export function lex(
  input: string,
  locale: Locale,
  keywords: ReadonlyMap<string, Keyword> = buildKeywords([locale]),
  isUnitAlias: (text: string) => boolean = () => false,
  grammars: readonly Grammar[] = grammarsFor([locale]),
): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  const isDigit = (c: string) => c >= "0" && c <= "9";
  const isLetter = (c: string) => /\p{L}/u.test(c);
  /**
   * A combining mark: `Mn`, `Mc` or `Me`. Continues a letter run, never starts
   * one.
   *
   * An abugida writes its vowels as marks hung on a consonant, and Unicode
   * classes those marks as `M` rather than `L`. So a Devanagari word is a
   * *mixture* of the two categories — किलोग्राम is क + ि + ल + ो + ग + ् + र +
   * ा + म, five letters and four marks interleaved — and a run built out of
   * `\p{L}` alone stops at the first vowel. Hindi did not lex as words; it lexed
   * as bare consonants, and `1 किलोग्राम` reported `Unknown unit "क"`. Every
   * Indic, Thai, Khmer and Ethiopic script has the same shape.
   *
   * Continuation only, and that is what makes this strictly additive: a run
   * still has to *begin* on a letter, so a stray mark with no letter in front of
   * it keeps falling through to the unrecognized-character path exactly as it
   * did before. The only inputs whose lexing changes are the ones where a mark
   * followed a letter — which, for the languages already here, either cannot
   * happen (`normalize()` runs NFKC first, and every Latin and Cyrillic
   * diacritic in use composes onto its base letter) or was the bug above.
   *
   * The marks are not handed to `Intl.Segmenter` as a separate concern: they are
   * part of the run string, and ICU already breaks a Devanagari run into words
   * correctly once it is given the whole run rather than one consonant.
   */
  const isMark = (c: string) => /\p{M}/u.test(c);

  /**
   * An apostrophe *between two letters* is part of the word, not a boundary.
   *
   * Ukrainian needs this to say its own numbers: п'ять (5), дев'ять (9),
   * п'ятнадцять (15), п'ятдесят (50), дев'яносто (90) and the hundreds built
   * on them all carry one, and none of them is a compound — the apostrophe is
   * an orthographic mark separating a consonant from a following iotated
   * vowel, as much a part of the word as any letter. Without this, `lex` cut
   * "п'ять кг" into "п", "ять" and "кг", and every spelled Ukrainian numeral
   * containing an apostrophe was unreachable through the parser while
   * `ukrainian.numerals(["п'ять"])` answered 5 correctly — the table was right
   * and the word never arrived.
   *
   * Three spellings, because three are in use and a user types whichever their
   * keyboard offers: U+2019 is what Ukrainian typography and most word
   * processors produce, U+02BC is the letter-apostrophe some standards
   * prescribe, and U+0027 is what a plain keyboard gives. `normalize()` folds
   * none of them, so they arrive here as typed.
   *
   * Between two *letters*, and deliberately not otherwise: a trailing
   * apostrophe stays a boundary, so a prime-mark unit ("5 ft'") is unaffected,
   * and so is any input that ends a quoted word. English is untouched by
   * construction — no alias in the repo contains an apostrophe, and neither
   * corpus contains one at all.
   */
  const APOSTROPHES = new Set(["'", "’", "ʼ"]);
  const isInnerApostrophe = (at: number) =>
    APOSTROPHES.has(input[at] as string) &&
    at > 0 &&
    isLetter(input[at - 1] as string) &&
    isLetter(input[at + 1] ?? "");

  /**
   * How far `grammar` reads the digit run starting at `from`, after backing off
   * a trailing separator that turned out to be punctuation.
   *
   * Per grammar and not once for the format locale, which is the whole of this
   * task at the lexing end: the same source characters mean different things to
   * different grammars, so "1 000,5" runs to seven characters under Ukrainian's
   * and stops at one under English's, and the caller compares the two.
   *
   * `normalize()` folds every whitespace run to a plain space before `lex` runs,
   * so a language whose group separator is a *non-breaking* space never sees its
   * own separator here: Ukrainian groups with U+00A0 and French ICU with U+202F,
   * and by this point the formatter's own "2\u00A0000" has arrived as "2 000".
   * Accepting the folded form is what makes such a language's output re-readable
   * — without it `evaluate(evaluate("2 кг в грамах").formatted)` lexes two
   * numbers and throws, which is the gap `@smartput/datarate` and
   * `@smartput/tempo` each pinned while waiting for this.
   *
   * The lookahead is what keeps it from swallowing a word boundary: a group
   * separator is followed by exactly three digits, so "2 000 г" is one number
   * while "2 3 кг" stays two tokens. A grammar that declares a plain space as
   * its separator outright (`numberFormat: { group: " " }`) is left on the
   * unconditional branch, where it already was.
   */
  const scanRun = (from: number, grammar: Grammar): number => {
    const groupFoldsToSpace = grammar.group !== " " && /\s/.test(grammar.group);
    const isFoldedGroup = (at: number) =>
      groupFoldsToSpace &&
      input[at] === " " &&
      isDigit(input[at + 1] ?? "") &&
      isDigit(input[at + 2] ?? "") &&
      isDigit(input[at + 3] ?? "") &&
      !isDigit(input[at + 4] ?? "");
    let at = from;
    while (
      at < input.length &&
      (isDigit(input[at] as string) ||
        input[at] === grammar.group ||
        input[at] === grammar.decimal ||
        isFoldedGroup(at))
    ) {
      at += 1;
    }
    // A trailing group/decimal symbol is punctuation, not part of the number.
    while (at > from && !isDigit(input[at - 1] as string)) at -= 1;
    return at;
  };

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
      const scans = grammars.map((grammar) => {
        const end = scanRun(start, grammar);
        return {
          grammar,
          end,
          value: end > start ? parseNumber(input.slice(start, end), grammar) : null,
        };
      });
      // The maximal run, over every grammar including the ones that then failed
      // to parse it. A grammar that stopped earlier was reading a word boundary
      // where another grammar reads a separator — English stopping at "1" in
      // "1 000,5" — so its shorter reading is not a rival reading of this run,
      // it is a reading of a different run and is dropped. A grammar that
      // consumed the whole run and could not parse it takes no reading with it,
      // but it does not shorten the run either.
      const end = Math.max(...scans.map((scan) => scan.end));
      const byValue = new Map<string, { value: Decimal; locales: string[] }>();
      for (const scan of scans) {
        if (scan.end !== end || scan.value === null) continue;
        const key = scan.value.toString();
        const hit = byValue.get(key);
        if (hit === undefined)
          byValue.set(key, { value: scan.value, locales: [...scan.grammar.locales] });
        else
          for (const id of scan.grammar.locales)
            if (!hit.locales.includes(id)) hit.locales.push(id);
      }
      const readings: NumberReading[] = [...byValue.values()].map((reading) => ({
        value: reading.value,
        locales: reading.locales.sort(),
      }));
      const chosen =
        readings.find((reading) => reading.locales.includes(locale.id)) ?? readings[0];
      // Every grammar rejected the run: it is not a number, and `lex` steps one
      // character and resynchronises exactly as it always has.
      if (chosen === undefined) {
        i = start + 1;
        continue;
      }
      tokens.push({
        type: "number",
        // The format locale's reading, with the first as the fallback for a run
        // only some other installed grammar could read at all ("1 000,5" on an
        // engine formatting in English). Ranking the readings against each other
        // is the solver's job; this is only what a reader who asks for one gets.
        value: chosen.value,
        readings,
        text: input.slice(start, end),
        start,
        end,
      });
      i = end;
      continue;
    }

    if (isLetter(ch)) {
      const start = i;
      while (
        i < input.length &&
        (isLetter(input[i] as string) ||
          isMark(input[i] as string) ||
          isInnerApostrophe(i))
      ) {
        i += 1;
      }
      const letterEnd = i;
      // A unit alias may end in digits -- M2 registers m2, cm2, km2 and m3.
      // Without absorbing that suffix the run lexes as a word followed by a
      // number, which no unit can claim, so those four aliases were
      // unreachable through the parser: "1 m2" threw UnitParseError while
      // "1 sqm" evaluated. Segmentation still runs over the letters alone --
      // Intl.Segmenter would keep "m2" whole, but a locale `segment` hook
      // returning substrings of its input cannot be asked to.
      //
      // A digit sequence FOLLOWED BY A LETTER ends the word instead: "h30m" is
      // an hour, thirty, a minute, and "ft3in" is five feet three inches. That
      // is how people write a compound quantity without spaces, and before this
      // the whole run went to the resolver as one word — `Unknown unit "h30"`.
      // Trailing digits with nothing after them still stay attached, because
      // that is the case the paragraph above is about and "30 m2" has to keep
      // reading as thirty square metres.
      //
      // Followed by a letter is not enough on its own, and a language that
      // writes no spaces is what proves it: "5000cm2をm2" puts a particle
      // straight after the alias, so the positional rule alone would cut "cm2"
      // into "cm" and 2 and break every CJK area and volume row in the corpus.
      // So the run stays whole when some installed vocabulary actually spells a
      // unit that way — the same `isUnitAlias` oracle ruling R-B1 reads below,
      // asked about the word the digits would attach to. Registered beats
      // positional; nothing else does, so "h30" and "加3", which no vocabulary
      // claims, split as they should.
      //
      // The digits are not consumed here when the run splits: `i` stays at the
      // end of the letters and the main loop's number branch picks them up on
      // its next turn, which is what keeps every token's `start`/`end` an index
      // into the source and `Result.spans` pointing into the caller's string.
      let digitEnd = letterEnd;
      while (digitEnd < input.length && isDigit(input[digitEnd] as string)) digitEnd += 1;
      const run = input.slice(start, letterEnd);
      const words = locale.language.segment
        ? locale.language.segment(run)
        : defaultSegment(run, locale.id);
      const splits =
        digitEnd > letterEnd &&
        digitEnd < input.length &&
        isLetter(input[digitEnd] as string) &&
        !isUnitAlias((words.at(-1) ?? "") + input.slice(letterEnd, digitEnd));
      i = splits ? letterEnd : digitEnd;
      const digits = splits ? "" : input.slice(letterEnd, digitEnd);
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
        // Ruling R-B1. "5 ft 3 in" ends in a keyword and throws today, so
        // nothing that works can regress: this branch fires only in the
        // positions where the conversion reading is impossible.
        //
        // Three conditions, all required. Preceded by a number, because `in` as
        // a unit is a count of inches. At end of input, or followed by an
        // operator or another `in`, because a conversion keyword needs a target
        // after it and these are the positions where none can follow — "5 ft 3
        // in cm" still converts, and "5 ft 3 in in cm" now means what it says.
        // And spelled as a unit by some installed vocabulary, because a
        // language that does not write the inch this way has no reading to
        // offer and the keyword is all there ever was.
        //
        // Deliberately not generalised past `in`: it is the only connective in
        // any installed language that collides with a unit alias, and a rule
        // that re-lexed any keyword on positional evidence alone would be
        // guessing on behalf of languages nobody has read yet.
        const canBeInch =
          keyword === "in" &&
          tokens.at(-1)?.type === "number" &&
          ["end", "op", "in"].includes(
            nextSignificant(input, wordEnd, keywords, locale.id),
          ) &&
          isUnitAlias(text);
        tokens.push(
          keyword === undefined || canBeInch
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
