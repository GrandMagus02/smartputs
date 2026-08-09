import { defineKind, type Kind, type LiteralMatcher } from "@smartput/core";
import { addDuration, parseDateTime } from "@smartput/datetime";
import { DATE_KIND, DATE_UNIT, unwrap, wrap } from "./value";

export interface DateOptions {
  /**
   * Summed into every claim this kind makes. Negative by default so that a
   * bare "today" still reads as a `datetime` and formats as it always has;
   * the range signatures in `@smartput/date-range` carry +20 of their own,
   * which is what lets "today to friday" outscore a zone conversion.
   */
  weight?: number;
}

/**
 * Mirrors `RANGE_WEIGHTS.reading` in `@smartput/range-core`, deliberately as a
 * copy rather than an import: this package depends on `@smartput/core` and
 * `@smartput/datetime` and nothing else, because a kind that recognizes a
 * calendar day should not drag in the interval algebra to do it. The number is
 * only meaningful against the +20 a range signature pays back, so the two are
 * documented together there.
 */
export const DEFAULT_DATE_WEIGHT = -5;

/**
 * The one matcher this kind registers, and it parses nothing: `parseDateTime`
 * is `@smartput/datetime`'s, already run against this same offset for the
 * datetime reading. Re-reading its answer rather than loading chrono a second
 * time is what makes both readings claim the *same span*, which is what makes
 * M6.3's fold carry them forward together instead of picking one.
 */
const dateLiteral =
  (weight: number): LiteralMatcher =>
  (input, offset, ctx) => {
    const match = parseDateTime(input, offset, ctx);
    if (match === null) return null;
    // A day the user named, and no clock time. "2026-03-01 08:00" is both and
    // belongs to datetime alone; "3pm" is neither and belongs to `time`.
    if (!match.hasDate || match.hasTime) return null;
    const value = wrap(match.zdt);
    return {
      kind: DATE_KIND,
      unit: value.unit,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: match.length,
      weight,
      // "friday" has to be able to stand on the right of `to`.
      targetable: true,
    };
  };

/**
 * `YYYY-MM-DD`, straight off `meta.day`, with no zone and no clock.
 *
 * Built from the stored string rather than from `Intl.DateTimeFormat` for the
 * reason datetime's formatter gives: the golden corpus asserts formatted output
 * verbatim, and ICU's date patterns move between runtime versions.
 */
function formatDate(value: { meta?: Readonly<Record<string, unknown>> }): string {
  return String(value.meta?.day ?? "");
}

/**
 * A calendar day. Opaque, because a day is not a scalar on a ratio line: its
 * one "unit" is a label, and every operation it supports is a declared
 * signature.
 *
 * A factory as well as a constant so an embedder can retune the reading weight
 * without forking the kind — an app that wants "today" to *mean* a date rather
 * than an instant passes `{ weight: 0 }` and gets exactly that, with no other
 * behaviour changed.
 */
export function createDate(opts: DateOptions = {}): Kind {
  return defineKind({
    id: DATE_KIND,
    value: {
      mode: "opaque",
      // See `@smartput/datetime`: canonical is an instant, so ordering is what
      // the scalar is for. Ruling C5.
      ordered: true,
      units: [DATE_UNIT],
    },
    literals: [dateLiteral(opts.weight ?? DEFAULT_DATE_WEIGHT)],
    ops: [
      {
        op: "+",
        left: DATE_KIND,
        right: "duration",
        result: DATE_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(l), r, 1)),
      },
      {
        // "3 d + today" is the same expression written the other way round, and
        // a solver with no signature for it reports a dimension mismatch on
        // input a user considers obviously fine.
        op: "+",
        left: "duration",
        right: DATE_KIND,
        result: DATE_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(r), l, 1)),
      },
      {
        op: "-",
        left: DATE_KIND,
        right: "duration",
        result: DATE_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(l), r, -1)),
      },
    ],
    format: formatDate,
  });
}

/** The kind as a consumer normally wants it: the default reading weight. */
export const date: Kind = createDate();
