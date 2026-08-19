import type { LiteralMatch, LiteralMatcher } from "@smartput/kind";
import type { Color } from "@urcolor/core";
import {
  type ChannelAmount,
  type ChannelDef,
  type ChannelWords,
  colorFromChannels,
  matchChannelWord,
  writeChannel,
} from "./channels";
import { type BaseReader, colorClaim, DEFAULT_SYNTAX_WEIGHT } from "./matcher";
import { addChannels, type ColorUnit, unitForSpace } from "./value";

/**
 * The second of the two honest ways to give this engine a new binary reading.
 *
 * `OpSymbol` and `Keyword` are both closed unions in core, so "darken", "with"
 * and "mix" cannot become operators without core learning what a colour is —
 * which is the one thing the design says core never does. A literal matcher,
 * on the other hand, is offered the whole input and an offset, and may claim
 * as many tokens as it can read. `@smartput/datetime` claims "next week
 * monday" that way; this claims "#eeff66 darken 20%" the same way, and the
 * fold turns it into one value.
 *
 * What that buys and what it costs are both worth stating. It buys phrasings
 * with no operator budget at all, in any order the grammar below allows. It
 * costs precedence: a claimed phrase is a leaf, so "#eeff66 darken 20% + #111"
 * is `(#eeff66 darken 20%) + #111` and there is no way to write the other
 * grouping. That is the right default — the verbs bind to their colour — and
 * parentheses are there for anyone who wants otherwise.
 */
export const DEFAULT_EXPRESSION_WEIGHT = DEFAULT_SYNTAX_WEIGHT;

interface Num {
  readonly value: number;
  readonly percent: boolean;
  readonly end: number;
}

const isDigit = (c: string) => c >= "0" && c <= "9";
/**
 * Unicode letters and marks, not `[a-z]`. The verbs are English, but the
 * channel words this scanner walks past on the way to one are not — see
 * `matchChannelWord`, which learned the same lesson.
 */
const LETTER = /[\p{L}\p{M}]/u;
const isLetter = (c: string) => LETTER.test(c);

const skipSpace = (input: string, at: number): number => {
  let i = at;
  while (input[i] === " " || input[i] === "\t") i += 1;
  return i;
};

/**
 * A number as this matcher reads it: digits, an optional fraction, an optional
 * trailing `%`.
 *
 * Deliberately not the locale's number grammar. A matcher runs before
 * `foldNumerals` and reads raw characters, so it has no tokens to borrow and
 * asking the language for its separators would mean re-implementing the
 * lexer's number branch here. The phrasings this grammar exists for are typed
 * by people writing CSS, where `.` is the decimal point and grouping does not
 * appear — and anything else still reaches the ordinary parser untouched,
 * because a matcher that returns `null` costs nothing.
 */
function readNumber(input: string, at: number): Num | null {
  let i = at;
  if (input[i] === "-" || input[i] === "+") i += 1;
  const digitsStart = i;
  while (i < input.length && isDigit(input[i] as string)) i += 1;
  if (input[i] === ".") {
    i += 1;
    while (i < input.length && isDigit(input[i] as string)) i += 1;
  }
  if (i === digitsStart) return null;
  const text = input.slice(at, i);
  const percent = input[i] === "%";
  if (percent) i += 1;
  const value = Number(text);
  return Number.isFinite(value) ? { value, percent, end: i } : null;
}

function readWord(input: string, at: number): { word: string; end: number } | null {
  let i = at;
  while (i < input.length && isLetter(input[i] as string)) i += 1;
  return i === at ? null : { word: input.slice(at, i).toLowerCase(), end: i };
}

/** A 0–1 amount. `20%` and `0.2` are the same amount; ruling stated in the docs. */
const fractionOf = (n: Num): number => (n.percent ? n.value / 100 : n.value);

/** Degrees. A percentage of a full turn is what `%` means on an angle. */
const degreesOf = (n: Num): number => (n.percent ? (n.value / 100) * 360 : n.value);

/** CSS units for a channel: `50%` is half of the channel's own full scale. */
const cssOf = (n: Num, def: ChannelDef): number =>
  n.percent ? (n.value / 100) * def.percentRef : n.value;

/** Verbs taking a 0–1 amount, mapped to the `Color` method that does the work. */
const AMOUNT_VERBS: Readonly<Record<string, (c: Color, amount: number) => Color>> = {
  darken: (c, a) => c.darken(a),
  lighten: (c, a) => c.lighten(a),
  brighten: (c, a) => c.lighten(a),
  saturate: (c, a) => c.saturate(a),
  desaturate: (c, a) => c.desaturate(a),
  fade: (c, a) => c.withAlpha(Math.max(0, Math.min(1, c.alpha - a))),
};

/** Verbs taking no argument at all. */
const NULLARY_VERBS: Readonly<Record<string, (c: Color) => Color>> = {
  negate: (c) => c.negate(),
  invert: (c) => c.negate(),
  complement: (c) => c.complement(),
};

/** Verbs taking another colour, and optionally an amount after it. */
const COLOR_VERBS = new Set(["mix", "blend", "add", "plus"]);

export interface ExpressionOptions {
  /** Summed into a claim this matcher makes. */
  expressionWeight?: number;
  /**
   * Channel words beyond the English ones, so "#eeff66 with 150 Farbton" reads.
   * The same map `defineColorChannel` takes; `@smartput/color/i18n` builds it.
   */
  channelWords?: ChannelWords;
}

/**
 * `<base> <verb>…` and `<n> <channel> <n> <channel> <n> <channel>`.
 *
 * ```
 * #eeff66 darken 20%          #eeff66 darken 0.2
 * #eeff66 with 150 hue        #eeff66 with 150 hue 50% alpha
 * #eeff66 mix blue 30%        #eeff66 add #110000
 * 100 hue 100 sat 50 brightness
 * ```
 *
 * Returns `null` for a bare colour with no verb after it: that is
 * `createCssLiteral`'s claim, and two matchers making the identical claim
 * would put two identical readings in front of the solver.
 */
export function createExpressionLiteral(
  readBase: BaseReader,
  opts: ExpressionOptions = {},
): LiteralMatcher {
  const weight = opts.expressionWeight ?? DEFAULT_EXPRESSION_WEIGHT;
  const channelWords = opts.channelWords ?? {};

  /** `<n> <channel>` pairs, as many as follow. */
  function readChannelPairs(
    input: string,
    at: number,
  ): { pairs: ChannelAmount[]; end: number } {
    const pairs: ChannelAmount[] = [];
    let i = at;
    for (;;) {
      const cursor = skipSpace(input, i);
      const num = readNumber(input, cursor);
      if (num === null) break;
      const hit = matchChannelWord(input, skipSpace(input, num.end), channelWords);
      if (hit === null) break;
      pairs.push({ def: hit.def, css: cssOf(num, hit.def) });
      i = hit.end;
    }
    return { pairs, end: i };
  }

  return (input, offset, ctx) => {
    let color: Color | null = null;
    let unit: ColorUnit = "hex";
    let cursor = offset;
    const base = readBase(input, offset, ctx.isUnitAlias);

    if (base !== null) {
      color = base.color;
      unit = base.unit;
      cursor = base.end;
    } else {
      // No colour here, so try the channel-list form. A partial set is refused
      // by `colorFromChannels`, which is what keeps "100 hue" a hue.
      const list = readChannelPairs(input, offset);
      const built = colorFromChannels(list.pairs);
      if (built === null) return null;
      color = built;
      unit = unitForSpace(built.space);
      cursor = list.end;
      // A complete channel list IS the claim, verbs or not: nothing else in
      // the package reads it, so returning null here would lose it.
    }

    let verbs = 0;
    for (;;) {
      const at = skipSpace(input, cursor);
      const word = readWord(input, at);
      if (word === null) break;

      const nullary = NULLARY_VERBS[word.word];
      if (nullary !== undefined) {
        color = nullary(color);
        cursor = word.end;
        verbs += 1;
        continue;
      }

      const amountVerb = AMOUNT_VERBS[word.word];
      if (amountVerb !== undefined) {
        const num = readNumber(input, skipSpace(input, word.end));
        if (num === null) break;
        color = amountVerb(color, fractionOf(num));
        cursor = num.end;
        verbs += 1;
        continue;
      }

      if (word.word === "rotate" || word.word === "spin") {
        const num = readNumber(input, skipSpace(input, word.end));
        if (num === null) break;
        color = color.rotateHue(degreesOf(num));
        cursor = num.end;
        verbs += 1;
        continue;
      }

      if (word.word === "with") {
        const list = readChannelPairs(input, word.end);
        if (list.pairs.length === 0) break;
        for (const { def, css } of list.pairs) color = writeChannel(color, def, css);
        cursor = list.end;
        verbs += 1;
        continue;
      }

      if (COLOR_VERBS.has(word.word)) {
        const other = readBase(input, skipSpace(input, word.end), ctx.isUnitAlias);
        if (other === null) break;
        if (word.word === "add" || word.word === "plus") {
          color = addChannels(color, other.color);
          cursor = other.end;
        } else {
          const num = readNumber(input, skipSpace(input, other.end));
          color = color.mix(other.color, num === null ? 0.5 : fractionOf(num));
          cursor = num === null ? other.end : num.end;
        }
        verbs += 1;
        continue;
      }

      break;
    }

    if (base !== null && verbs === 0) return null;
    return claim(color, cursor - offset, weight, unit);
  };
}

const claim = (
  color: Color,
  length: number,
  weight: number,
  unit: ColorUnit,
): LiteralMatch => colorClaim(color, length, weight, unit);
