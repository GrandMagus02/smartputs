import { Decimal, defineKind, type Kind, type LiteralMatcher } from "@smartput/core";

export const INDEX_KIND = "index";

/**
 * The kind's one unit, and a label rather than a scale. A position is not a
 * quantity of anything: "6" in "from 6 to 9" is the name of an item, and the
 * distance between two of them is a count of items rather than a length of
 * position.
 *
 * Hyphenated rather than the bare "position" it used to be: this kind ships no
 * vocabulary, so ruling R2 indexes the unit under its own id, and `lex` builds
 * a word token out of `\p{L}` runs alone. See `@smartput/date`'s `DATE_UNIT`.
 */
export const INDEX_UNIT = "index-position";

/**
 * Charged to every claim this kind makes, so a bare "6" is still a `number` and
 * still formats as one.
 *
 * Four times the -5 `@smartput/date` and `@smartput/time` charge, and the extra
 * is not slack — it is what makes `dashWeight` a working dial. `contextBonus`
 * pays +30 to a binary node whose operands agree on kind *unless that kind is
 * `number`*, which is deliberate over there (two bare numbers agreeing is no
 * evidence of anything) and asymmetric here: `- | index | index` collects the
 * bonus and `- | number | number` never can. So the two paths for "4-5" are
 *
 * ```
 * - | number | number     2 × NUMBER_FALLBACK_WEIGHT           = -1
 * - | index  | index      2 × reading + CONTEXT_BONUS + dash
 * ```
 *
 * and the +30 arrives whether or not anyone asked for it. At a reading of -5
 * the range path scores 20 with `dashWeight: 0` and still wins, so the dial
 * documented as "gives subtraction back" would give nothing back at all. The
 * penalty therefore has to be steep enough that the bonus alone loses:
 * `2 × reading + 30 < -1`, so anything below -15.5. At -20 the default wins by
 * 11 and `dashWeight: 0` loses by 9 — both with room, and the winning score of
 * 10 stays under `TYPO_PENALTY` (15) so a selection can never overturn a
 * corrected reading.
 *
 * The number is not shared with `@smartput/range-core`'s `RANGE_WEIGHTS` for two
 * reasons: it is a different contest with a different competitor, and that
 * package depends on `@smartput/datetime` for `Temporal` — a kind that
 * recognises a list position should not link a calendar to do it.
 */
export const DEFAULT_INDEX_WEIGHT = -20;

export interface IndexOptions {
  weight?: number;
}

/** Letters and a percent sign — everything a unit is spelled with. */
const FOLLOWING_WORD = /^[a-z%]+/i;
const DIGITS = /^\d+/;

/**
 * A bare non-negative integer, claimed as a *position*.
 *
 * Two guards, and both are load-bearing:
 *
 * A run followed by a unit alias is declined — core's ruling R4, the same one
 * that keeps "10 m" from becoming a date. Without it every quantity in every
 * expression would carry a second reading of its number, and a single-token
 * literal claim keeps only a fallback, not the quantity binding that "10 m"
 * needs.
 *
 * A run followed by a decimal point and more digits is declined too. "4.5" is
 * one number and there is no item four-and-a-half; claiming the "4" would offer
 * the solver a position that the rest of the token contradicts.
 *
 * Negative positions are not claimed here at all. "-1" reaches the parser as
 * unary minus over "1", so the minus is the parser's and the digit run is this
 * matcher's — which is also why the two ends of "from -3 to -1" are read by
 * `range`'s own matcher rather than by two of these.
 *
 * `targetable`, because a position has to be able to stand on the right of `to`
 * — the same opt-in `@smartput/date` makes so that "friday" can close a range.
 */
const indexLiteral =
  (weight: number): LiteralMatcher =>
  (input, offset, ctx) => {
    const digits = DIGITS.exec(input.slice(offset))?.[0];
    if (digits === undefined) return null;

    const after = input.slice(offset + digits.length);
    if (/^\.\d/.test(after)) return null;
    const word = FOLLOWING_WORD.exec(after.trimStart())?.[0];
    if (word !== undefined && ctx.isUnitAlias(word.toLowerCase())) return null;

    return {
      kind: INDEX_KIND,
      unit: INDEX_UNIT,
      // The position **as written**. The origin shift belongs to whoever builds
      // the slice: this reading has no idea whether the phrase around it counts
      // from one, and a matcher that guessed would make `createRange`'s `origin`
      // option a lie.
      canonical: new Decimal(digits),
      length: digits.length,
      weight,
      targetable: true,
    };
  };

/**
 * A position in a list — the operand kind `range` is built out of, and useless
 * on its own.
 *
 * It is a separate kind rather than a reading of `number` because the registry
 * refuses a second claimant for a signature, and `- | number | number` is
 * already subtraction: there is no way to declare `- | number | number -> range`
 * beside it. The same wall `@smartput/time` hit with
 * `in | datetime | datetime`, and the same answer — a second kind over the same
 * surface, weighted so it loses every contest it is not wanted in.
 *
 * Register it wherever `range` is registered. `range`'s signatures name it by
 * string, and registry pass 4 does not check that a named operand kind exists,
 * so a `range` without an `index` beside it is silently a kind that claims
 * phrases and nothing else.
 */
export function createIndex(opts: IndexOptions = {}): Kind {
  return defineKind({
    id: INDEX_KIND,
    value: { mode: "opaque", units: [INDEX_UNIT] },
    literals: [indexLiteral(opts.weight ?? DEFAULT_INDEX_WEIGHT)],
    format: (value) => value.canonical.toString(),
  });
}

/** The kind as a consumer normally wants it: the default reading penalty. */
export const index: Kind = createIndex();
