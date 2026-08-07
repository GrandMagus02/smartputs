import {
  defineKind,
  type EvalCtx,
  type Kind,
  type LiteralMatcher,
  NoCandidateError,
  type Value,
} from "@smartput/core";
import { OFFSET_ZONES, parseOffsetZone, ZONES, zoneSymbol } from "@smartput/timezone";
import { parseDateTime } from "./chrono-bridge";
import { Temporal } from "./temporal";
import { addDuration, DATETIME_KIND, durationValue, unwrap, wrap } from "./value";

/**
 * The one matcher this kind registers. Everything date-shaped enters the engine
 * through here — there is no other path, and core knows nothing about dates.
 *
 * One reading, though M6.3 widened `LiteralMatcher` to return several. A place
 * name has homonyms — three Springfields, two Athenses — and a date does not:
 * chrono resolves a span to one instant against one clock, and a second reading
 * of "next friday" would be a second answer to a question that has one. What the
 * widening does buy this kind is the other half of the same change: the word
 * under a single-token claim now survives, so geo claiming "tokyo" the city no
 * longer costs `Asia/Tokyo` the alias (spec §6.3).
 */
const dateLiteral: LiteralMatcher = (input, offset, ctx) => {
  const match = parseDateTime(input, offset, ctx);
  if (match === null) return null;
  const value = wrap(match.zdt);
  return {
    kind: DATETIME_KIND,
    unit: value.unit,
    canonical: value.canonical,
    ...(value.meta ? { meta: value.meta } : {}),
    length: match.length,
  };
};

/**
 * "GMT+3" standing on its own, and — the reason it exists — standing to the
 * right of `in`.
 *
 * `targetable`, unlike the date literal beside it. A conversion target is a
 * narrower thing than a value (core's `LiteralReading` docs): "today in
 * tomorrow" must keep throwing, while "3pm in gmt+3" must not. An offset zone
 * is only ever a zone, so it opts in.
 *
 * The value it carries when nothing converts into it is the current time there,
 * which is the only instant a zone alone can mean. That makes a bare "GMT+3"
 * answerable where a bare "utc" is not — a difference this claim introduces
 * knowingly: "utc" reaches the engine as a unit alias, and a lone unit alias
 * has never been a quantity.
 */
const zoneLiteral: LiteralMatcher = (input, offset, ctx) => {
  const match = parseOffsetZone(input.slice(offset));
  if (match === null) return null;
  const value = wrap(
    Temporal.Instant.fromEpochMilliseconds(ctx.now).toZonedDateTimeISO(match.zone),
  );
  return {
    kind: DATETIME_KIND,
    unit: value.unit,
    canonical: value.canonical,
    ...(value.meta ? { meta: value.meta } : {}),
    length: match.length,
    targetable: true,
  };
};

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/**
 * `YYYY-MM-DD HH:MM <zone>`, built from Temporal fields rather than
 * `Intl.DateTimeFormat`.
 *
 * The golden corpus asserts formatted output verbatim (spec §10), and ICU's
 * date patterns move between runtime versions — a locale-aware date format
 * would make the corpus a test of the host's ICU build. Locale-aware date
 * formatting is M5's problem, together with the rest of i18n.
 */
function formatDateTime(iso: string): string {
  const zdt = Temporal.ZonedDateTime.from(iso);
  const date = `${zdt.year}-${pad(zdt.month)}-${pad(zdt.day)}`;
  const time = `${pad(zdt.hour)}:${pad(zdt.minute)}`;
  return `${date} ${time} ${zoneSymbol(zdt.timeZoneId)}`;
}

/**
 * The units of this kind: every zone `@smartput/timezone` ships, named and
 * written-as-an-offset alike — as bare ids, per ruling R1.
 *
 * The words for them — `tokyo`, `jst`, `japan`, and the symbol a formatter
 * prints — are not here: they are a `Vocabulary`, in `./locale/en`, because
 * words belong to a language and a zone id does not.
 *
 * Keys rather than a copy of the tables, because `defineKind` deep-freezes
 * what it is handed and the tables belong to a package that did not ask to be
 * frozen.
 */
const units: readonly string[] = Object.keys({ ...ZONES, ...OFFSET_ZONES });

/**
 * A place does not always carry a zone. A country reached by its *unit alias*
 * rather than by a claimed literal ("3pm in jp") gets `evaluate.ts`'s stand-in
 * right-hand side, which has the unit, the left operand's meta, and no zone at
 * all — so the miss is a real input, not a data bug to assert away.
 *
 * `NoCandidateError` rather than a new error type: a conversion target that
 * resolves to no zone is an unknown unit, which is what the engine already
 * reports for every other unreachable target. Temporal's own RangeError names
 * neither the input nor the unit the user typed.
 */
function placeZone(target: Value, ctx: EvalCtx): string {
  const zone = target.meta?.zone;
  if (typeof zone !== "string" || zone === "")
    throw new NoCandidateError(ctx.input ?? "", target.unit, []);
  try {
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(zone);
  } catch {
    throw new NoCandidateError(ctx.input ?? "", zone, []);
  }
  return zone;
}

export interface DatetimeOptions {
  /**
   * Matchers appended after this kind's own two. Everything they claim is still
   * a `datetime` reading; they exist so a claim can be built from data this
   * package refuses to depend on.
   */
  readonly literals?: readonly LiteralMatcher[];
}

/**
 * An instant with a time zone. Opaque, because it is not a scalar on a ratio
 * line: its "units" are IANA zones, and every operation it supports is a
 * declared signature. The engine has no date-specific code anywhere — which is
 * the whole claim M4 exists to test.
 *
 * A factory rather than only a constant, so `./holiday` can build the same kind
 * with one more literal matcher behind it. The rejected alternative is making
 * `@smartput/holiday` a plain dependency and registering that matcher here
 * unconditionally: `date-holidays` bundles a 768 KB rule table, which every
 * consumer of "today + 3 d" would then pay for a feature they did not ask for.
 * Pushing onto `datetime.literals` after the fact was rejected too — `defineKind`
 * deep-freezes the descriptor, and a kind whose behaviour depended on which
 * modules had been imported first is worse than one that is built once.
 *
 * `datetime` below stays exactly what it was, so nothing downstream changes.
 */
export function createDatetime(opts: DatetimeOptions = {}): Kind {
  return defineKind({
    id: DATETIME_KIND,
    value: { mode: "opaque", units },
    // Date first: on a tie the fold keeps both readings, and "3pm gmt+3" is one
    // date whose offset the zone matcher would only ever claim a suffix of.
    // Extras last for the same reason in reverse: a phrase they claim is longer
    // than anything chrono reads out of it, and longest wins outright.
    literals: [dateLiteral, zoneLiteral, ...(opts.literals ?? [])],
    ops: [
      {
        op: "+",
        left: DATETIME_KIND,
        right: "duration",
        result: DATETIME_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(l), r, 1)),
      },
      {
        // "3 d + today" is the same expression written the other way round, and a
        // solver that has no signature for it reports a dimension mismatch on
        // input a user considers obviously fine.
        op: "+",
        left: "duration",
        right: DATETIME_KIND,
        result: DATETIME_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(r), l, 1)),
      },
      {
        op: "-",
        left: DATETIME_KIND,
        right: "duration",
        result: DATETIME_KIND,
        apply: (l, r) => wrap(addDuration(unwrap(l), r, -1)),
      },
      {
        op: "-",
        left: DATETIME_KIND,
        right: DATETIME_KIND,
        result: "duration",
        apply: (l, r) => durationValue(l.canonical.minus(r.canonical)),
      },
      {
        // Time-zone conversion is an op, not a subsystem (spec §8): the target of
        // `in` is a unit of this kind, and a unit of this kind is a zone.
        op: "in",
        left: DATETIME_KIND,
        right: DATETIME_KIND,
        result: DATETIME_KIND,
        apply: (l, r) => wrap(unwrap(l).withTimeZone(r.unit)),
      },
      {
        // The geo bridge (geo spec §3.1). `place` is a kind this package neither
        // imports nor depends on: the zone arrives as a plain string on `meta`,
        // typed by core's `PlaceMeta`, so "3pm in new york" costs datetime one
        // signature and no gazetteer.
        //
        // Declaring a signature over an absent kind is safe because registry
        // pass 4 (`kind/registry.ts`) builds the op table without checking that
        // `left` and `right` name registered kinds. With geo absent this entry is
        // inert — no kind claims `place`, so the solver can never produce that
        // operand and the key is never looked up. Pass 4 *does* refuse a second
        // claimant of one signature, which is why datetime owns this one and geo
        // owns `in | place | place`.
        //
        // The rejected alternative was injecting a `PlaceLookup` into datetime,
        // which would make datetime's construction depend on geo being present to
        // serve a case a string on `meta` already covers.
        op: "in",
        left: DATETIME_KIND,
        right: "place",
        result: DATETIME_KIND,
        apply: (l, r, ctx) => wrap(unwrap(l).withTimeZone(placeZone(r, ctx))),
      },
    ],
    format: (value) => formatDateTime(String(value.meta?.iso ?? "")),
  });
}

/** The kind as every consumer has always had it: no extra matchers. */
export const datetime: Kind = createDatetime();
