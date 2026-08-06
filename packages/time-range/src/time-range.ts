import {
  Decimal,
  defineKind,
  type Kind,
  type LiteralMatcher,
  type Value,
} from "@smartput/core";
import { RANGE_WEIGHTS, WINDOWS, type Window, wrapRange } from "@smartput/range-core";
import { formatClock, NS_PER_DAY, TIME_KIND } from "@smartput/time";

export const TIME_RANGE_KIND = "time-range";

/**
 * The kind's one unit, and — as with `date`'s `DATE_UNIT` and `time`'s
 * `TIME_UNIT` — deliberately not a zone. A clock span is not anchored to one,
 * and a unit table naming zones would make "morning in tokyo" a `convert` node
 * whose target is a unit label rather than the zone conversion nobody declared.
 */
export const TIME_RANGE_UNIT = "clock-span";

const NS_PER_HOUR = new Decimal("3600000000000");

/**
 * What a window word's claim is worth against the `datetime` reading of the
 * same word, which is a real competitor and not a hypothetical one: chrono
 * parses "morning", "afternoon", "evening" and "night" — only "day" is left
 * alone — with `isCertain("hour")` false, so the bridge fills midnight in and
 * `@smartput/datetime` answers "morning" with *today at 00:00*. Two readings at
 * weight 0 is an `AmbiguityError` on a word that has one obvious meaning.
 *
 * Positive rather than a penalty on datetime, because the penalty belongs to
 * whoever loses and nothing here may reach into datetime's scoring. Ten clears
 * the tie with room and stays under `TYPO_PENALTY` (15), so a corrected reading
 * still outranks a window word — "moring" must correct to "morning" rather than
 * have "morning" win some other contest on the strength of this number.
 */
const WINDOW_WEIGHT = 10;

export interface TimeRangeOptions {
  /**
   * Weight on `- | time | time` and `in | time | time`. Must exceed twice the
   * `time` reading penalty or the contest ties; 0 hands "10:00 - 20:00" back to
   * subtraction, which is what someone doing clock arithmetic wants.
   */
  dashWeight?: number;
  /** Overrides merged over the default table. */
  windows?: Record<string, Window>;
}

/**
 * A clock span has no ordering across midnight, so a backwards pair wraps.
 *
 * This is the one range kind that never calls `assertOrdered`. "20:00 - 06:00"
 * is a night shift, not the inverted range `range-core` throws on: the two ends
 * are wall-clock readings with no day attached, so there is no fact of the
 * matter about which comes first, and picking one would make an overnight span
 * an error on input every rota in the world writes that way.
 *
 * `zone` is the empty string rather than the engine's zone, which `RangeMeta`
 * documents as a legitimate value: a clock span is not anchored to a zone, and
 * writing one in would invite a consumer to convert against it.
 */
function build(startNs: Decimal, endNs: Decimal): Value {
  const wraps = endNs.lte(startNs);
  return wrapRange(TIME_RANGE_KIND, TIME_RANGE_UNIT, startNs, {
    start: formatClock(startNs),
    end: formatClock(endNs),
    zone: "",
    wraps,
    // Stored rather than derived because a wrapping span's length is not
    // `end - start` and a consumer asking "how long is the night shift?"
    // should not have to know that. Ends stay half-open (design §3.1), so no
    // off-by-one correction belongs here either.
    lengthNs: (wraps ? endNs.plus(NS_PER_DAY) : endNs).minus(startNs).toString(),
  });
}

const hoursNs = (h: number) => NS_PER_HOUR.times(h);

/**
 * The named windows — "morning", "night" — as a literal matcher rather than as
 * vocabulary, because they have no two-operand shape for a signature to hang
 * off and no unit for the alias index to hold.
 *
 * Longest name wins when two entries share a prefix. Nothing in the default
 * table does, but an embedder adding "late night" beside "night" would
 * otherwise get "night" claimed out from under it — the shorter claim ends on a
 * token boundary too, so the fold has no way to prefer the longer one after the
 * fact.
 *
 * The claim is not `targetable`. "3pm in morning" is not a conversion, and a
 * targetable window would make it one — the same line `@smartput/datetime`'s
 * `dateLiteral` draws for "today in tomorrow".
 */
const windowLiteral =
  (windows: Record<string, Window>): LiteralMatcher =>
  (input, offset) => {
    const rest = input.slice(offset).toLowerCase();
    let hit: { name: string; window: Window } | null = null;
    for (const [name, window] of Object.entries(windows)) {
      if (!rest.startsWith(name)) continue;
      if (hit === null || name.length > hit.name.length) hit = { name, window };
    }
    if (hit === null) return null;
    const value = build(hoursNs(hit.window.start), hoursNs(hit.window.end));
    return {
      kind: TIME_RANGE_KIND,
      unit: TIME_RANGE_UNIT,
      canonical: value.canonical,
      ...(value.meta ? { meta: value.meta } : {}),
      length: hit.name.length,
      weight: WINDOW_WEIGHT,
    };
  };

/**
 * A span between two wall-clock times. Opaque, because its canonical is the
 * start's nanosecond-of-day count rather than a scalar with convertible units,
 * and both of its operations are declared signatures.
 *
 * The two signatures are the same operation written two ways: `to` and `as` are
 * surface words core's `keywordFor` maps onto the `in` keyword, so
 * "10:00 to 20:00" arrives as a `convert` node and "10:00 - 20:00" as a binary
 * one. Both carry `dashWeight`, which is what lets the pair outscore
 * `- | datetime | datetime` for the dash form — see design §4.1 for the
 * arithmetic. `in` needs it as much as `-` does: the right operand is a `time`
 * reading either way, and both readings pay the -5.
 */
export function createTimeRange(opts: TimeRangeOptions = {}): Kind {
  const weight = opts.dashWeight ?? RANGE_WEIGHTS.signature;
  const windows = { ...WINDOWS, ...(opts.windows ?? {}) };
  const span = {
    left: TIME_KIND,
    right: TIME_KIND,
    result: TIME_RANGE_KIND,
    weight,
    apply: (l: Value, r: Value) => build(l.canonical, r.canonical),
  };
  return defineKind({
    id: TIME_RANGE_KIND,
    value: {
      mode: "opaque",
      units: { [TIME_RANGE_UNIT]: { aliases: [], symbol: "" } },
    },
    literals: [windowLiteral(windows)],
    ops: [
      { op: "-", ...span },
      { op: "in", ...span },
    ],
    format: (value) =>
      `${String(value.meta?.start ?? "")} → ${String(value.meta?.end ?? "")}`,
  });
}

/** The kind as every consumer gets it: the default weight, the default table. */
export const timeRange: Kind = createTimeRange();
