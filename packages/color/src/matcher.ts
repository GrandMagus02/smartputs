import type { LiteralMatch, LiteralMatcher } from "@smartput/kind";
import { Color, parseNamed, tryParse } from "@urcolor/core";
import { cssFor, notationFor } from "./notations";
import { COLOR_KIND, type ColorUnit, colorMeta, packSrgb, unitForSpace } from "./value";

/**
 * What a CSS notation claim scores. Zero, because `#3b82f6`,
 * `rgb(59 130 246)` and `oklch(0.63 0.19 260)` are not words: nothing in any
 * language reads them, so there is no competing reading to rank against.
 */
export const DEFAULT_SYNTAX_WEIGHT = 0;

/**
 * What a bare CSS keyword scores, and why it is negative.
 *
 * `NAMED_COLORS` holds 148 keywords and a good third of them are ordinary
 * English words — `tan`, `plum`, `orange`, `gold`, `snow`, `linen`, `peru`,
 * `khaki`, `azure`, `ivory`, `wheat`, `tomato`, `lime`. Ambiguity is data, so
 * the reading is kept and weighted down rather than deleted: "tan" still reads
 * as the word first, and as `#d2b48c` when the sentence is about colour. A
 * single-token claim keeps the word's ordinary reading beside it as the
 * literal fold's `fallback`, so the weight is the whole of the cost.
 */
export const DEFAULT_KEYWORD_WEIGHT = -8;

const isDigit = (c: string) => c >= "0" && c <= "9";
const isHexDigit = (c: string) => isDigit(c) || /[a-f]/i.test(c);
const isLetter = (c: string) => /[a-z]/i.test(c);

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` — and nothing between those lengths. */
const HEX_LENGTHS = new Set([3, 4, 6, 8]);

/**
 * The `#` is not a token, and a hash is offered from either side.
 *
 * `lex` drops it — "#3b82f6" lexes as number/word/number/word starting at
 * offset 1 — so the literal fold offers an offset *after* the hash and this has
 * to look one character behind to find it. `expression.ts` reads raw characters
 * instead and lands *on* the hash, because nothing has tokenised the tail of
 * "#eeff66 mix #ffffff" for it. Both are real positions, so both are accepted,
 * and the returned `end` is what tells the two apart.
 */
function matchHex(input: string, offset: number): { text: string; end: number } | null {
  const start = input[offset] === "#" ? offset + 1 : offset;
  if (input[start - 1] !== "#") return null;
  let end = start;
  while (end < input.length && isHexDigit(input[end] as string)) end += 1;
  return HEX_LENGTHS.has(end - start) ? { text: input.slice(start - 1, end), end } : null;
}

/**
 * `ident( … )`, balanced. Nesting is real — `color(from red srgb …)`,
 * `rgb(calc(1 + 1) 0 0)` — so the scan counts depth rather than taking the
 * first `)`.
 *
 * Which idents are notations is left to `tryParse`. A list here would be a
 * second copy of upstream's `NOTATIONS` to keep in step, and the cost of
 * asking is one failed parse on a word that happens to be followed by a
 * parenthesis.
 */
function matchFunctional(input: string, offset: number): string | null {
  let i = offset;
  while (i < input.length && isLetter(input[i] as string)) i += 1;
  if (i === offset || input[i] !== "(") return null;
  let depth = 0;
  for (let j = i; j < input.length; j += 1) {
    const c = input[j];
    if (c === "(") depth += 1;
    else if (c === ")") {
      depth -= 1;
      if (depth === 0) return input.slice(offset, j + 1);
    }
  }
  return null;
}

/**
 * The bracketless form: `rgb 255 60 128`, `oklch 0.6 0.2 250`, `p3 1 0 0`.
 *
 * People write a colour that way constantly — in a spreadsheet cell, in a
 * message, out of a design tool that prints the channels and not the syntax —
 * and CSS's own brackets and commas are the part nobody types by choice. The
 * whole implementation is a scanner that finds the notation word and its three
 * (or four) arguments, and then hands `cssFor` the job of writing the brackets
 * back in so `tryParse` sees the notation it already knows. Not one channel is
 * interpreted here, which is what keeps percentages, `none`, `50deg` and the
 * `/ alpha` form working without this file having heard of any of them.
 *
 * Exactly three arguments, with alpha after a `/` and nowhere else. Accepting
 * two would make "rgb 255 60" a colour with a channel invented for it, and
 * accepting a fourth positionally would disagree with CSS, where the slash is
 * what separates alpha from the coordinates.
 */
function matchBare(input: string, offset: number): { text: string; end: number } | null {
  // Letters *and* digits, unlike the keyword branch: `p3`, `a98`, `rec2020` and
  // `xyzd65` are notation names with a digit run inside them, and a
  // letters-only scan read "p" and gave up.
  let head = offset;
  while (head < input.length && /[a-z0-9]/i.test(input[head] as string)) head += 1;
  const word = head === offset ? null : input.slice(offset, head);
  if (word === null) return null;
  const def = notationFor(word.toLowerCase());
  if (def?.fn === undefined) return null;

  const args: string[] = [];
  let at = head;
  for (let i = 0; i < 3; i += 1) {
    const arg = readArg(input, at);
    if (arg === null) return null;
    args.push(arg.text);
    at = arg.end;
  }

  let alpha: string | undefined;
  let slash = at;
  while (input[slash] === " " || input[slash] === "\t") slash += 1;
  if (input[slash] === "/") {
    const arg = readArg(input, slash + 1);
    if (arg !== null) {
      alpha = arg.text;
      at = arg.end;
    }
  }

  return { text: cssFor(def, args, alpha), end: at };
}

/**
 * One CSS component value: a number with an optional unit or `%`, or the
 * keyword `none`.
 *
 * The characters are collected and passed through verbatim rather than parsed
 * into a JavaScript number, because `50%`, `0.5turn` and `none` all mean
 * something to `tryParse` and none of them survives a `Number()`.
 */
function readArg(input: string, from: number): { text: string; end: number } | null {
  let at = from;
  while (input[at] === " " || input[at] === "\t") at += 1;
  if (at === from && from !== 0 && input[from - 1] !== "/") return null;

  if (input.startsWith("none", at) && !isLetter(input[at + 4] ?? " ")) {
    return { text: "none", end: at + 4 };
  }

  const start = at;
  if (input[at] === "-" || input[at] === "+") at += 1;
  const digits = at;
  while (at < input.length && (isDigit(input[at] as string) || input[at] === "."))
    at += 1;
  if (at === digits) return null;
  // A unit or a percent sign, both of which belong to the number.
  if (input[at] === "%") at += 1;
  else while (at < input.length && isLetter(input[at] as string)) at += 1;
  return { text: input.slice(start, at), end: at };
}

function matchWord(input: string, offset: number): string | null {
  let end = offset;
  while (end < input.length && isLetter(input[end] as string)) end += 1;
  return end === offset ? null : input.slice(offset, end);
}

export interface CssLiteralOptions {
  /** Summed into a `#rrggbb` or `oklch(…)` claim. */
  syntaxWeight?: number;
  /** Summed into a bare `red`/`tan` claim. */
  keywordWeight?: number;
  /**
   * Recognise the 148 CSS colour keywords at all. On by default; a consumer
   * whose input is English prose and who only ever pastes hex can turn the
   * whole class of claims off rather than reweight it.
   */
  keywords?: boolean;
}

/**
 * `unit` is the notation the colour was *written* in, which is not always the
 * space it parsed into. `#3b82f6`, `rebeccapurple` and a dataset's "sky blue"
 * all land in sRGB, and printing them back as `rgb(59 130 246)` would answer a
 * question nobody asked; they are hex, and stay hex. Only a functional
 * notation — `oklch(…)`, `color(display-p3 …)` — names its own space, and
 * there {@link unitForSpace} is the right default.
 *
 * Deliberately not `targetable`. The right-hand side of `in` is a *notation*,
 * and the notations are units — so "#fff in red" must stay the
 * `UnitParseError` it reads as. Ruling borrowed wholesale from
 * `@smartput/datetime`, which learned it when "today in tomorrow" quietly
 * became legal and returned today.
 */
export function colorClaim(
  color: Color,
  length: number,
  weight: number,
  unit: ColorUnit = "hex",
): LiteralMatch {
  return {
    kind: COLOR_KIND,
    unit,
    canonical: packSrgb(color),
    meta: colorMeta(color),
    length,
    weight,
  };
}

/**
 * What a CSS colour at `offset` is, or `null`.
 *
 * Split out from the matcher below because it has two callers: this file's
 * literal, and `expression.ts`, which needs the *base* of "#eeff66 darken 20%"
 * and then keeps reading. A reader that returns an end offset composes; a
 * `LiteralMatcher` that returns a claim does not.
 */
export interface BaseMatch {
  readonly color: Color;
  readonly unit: ColorUnit;
  /** Offset just past the text read, so a caller can carry on from it. */
  readonly end: number;
  readonly weight: number;
}

export type BaseReader = (
  input: string,
  offset: number,
  isUnitAlias: (text: string) => boolean,
) => BaseMatch | null;

/**
 * Three shapes in one reader, because they are one question — "does a CSS
 * colour start here" — and `tryParse` is the one thing that answers it. The
 * keyword branch runs last so that a word which is both a keyword and the head
 * of a functional notation cannot be read as the shorter of the two.
 */
export function createCssBaseReader(opts: CssLiteralOptions = {}): BaseReader {
  const syntaxWeight = opts.syntaxWeight ?? DEFAULT_SYNTAX_WEIGHT;
  const keywordWeight = opts.keywordWeight ?? DEFAULT_KEYWORD_WEIGHT;
  const keywords = opts.keywords ?? true;

  return (input, offset, isUnitAlias) => {
    const hex = matchHex(input, offset);
    if (hex !== null) {
      const object = tryParse(hex.text);
      if (object !== null) {
        return {
          color: Color.from(object),
          unit: "hex",
          end: hex.end,
          weight: syntaxWeight,
        };
      }
    }

    const fn = matchFunctional(input, offset);
    if (fn !== null) {
      const object = tryParse(fn);
      if (object !== null) {
        const color = Color.from(object);
        return {
          color,
          unit: unitForSpace(color.space),
          end: offset + fn.length,
          weight: syntaxWeight,
        };
      }
    }

    const bare = matchBare(input, offset);
    if (bare !== null) {
      const object = tryParse(bare.text);
      if (object !== null) {
        const color = Color.from(object);
        return {
          color,
          unit: unitForSpace(color.space),
          end: bare.end,
          weight: syntaxWeight,
        };
      }
    }

    if (!keywords) return null;
    const word = matchWord(input, offset);
    if (word === null) return null;
    // A word some vocabulary already spells as a unit belongs to that unit, not
    // to this kind — ruling R4, the guard that keeps "10 m" from becoming a date.
    if (isUnitAlias(word.toLowerCase())) return null;
    const named = parseNamed(word.toLowerCase());
    if (named === null) return null;
    return {
      color: Color.from(named),
      unit: "hex",
      end: offset + word.length,
      weight: keywordWeight,
    };
  };
}

/** Every colour CSS itself can write, and nothing that needs a dataset. */
export function createCssLiteral(opts: CssLiteralOptions = {}): LiteralMatcher {
  const read = createCssBaseReader(opts);
  return (input, offset, ctx) => {
    const base = read(input, offset, ctx.isUnitAlias);
    if (base === null) return null;
    return colorClaim(base.color, base.end - offset, base.weight, base.unit);
  };
}
