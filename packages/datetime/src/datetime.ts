import { defineKind, type Kind, type LiteralMatcher } from "@smartput/core";
import { parseDateTime } from "./chrono-bridge";
import { Temporal } from "./temporal";
import { addDuration, DATETIME_KIND, durationValue, unwrap, wrap } from "./value";
import { ZONES } from "./zones";

/**
 * The one matcher this kind registers. Everything date-shaped enters the engine
 * through here — there is no other path, and core knows nothing about dates.
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
  return `${date} ${time} ${ZONES[zdt.timeZoneId]?.symbol ?? zdt.timeZoneId}`;
}

const units: Record<string, { aliases: string[]; symbol: string }> = {};
for (const [zone, def] of Object.entries(ZONES)) {
  units[zone] = { aliases: [...def.aliases], symbol: def.symbol };
}

/**
 * An instant with a time zone. Opaque, because it is not a scalar on a ratio
 * line: its "units" are IANA zones, and every operation it supports is a
 * declared signature. The engine has no date-specific code anywhere — which is
 * the whole claim M4 exists to test.
 */
export const datetime: Kind = defineKind({
  id: DATETIME_KIND,
  value: { mode: "opaque", units },
  literals: [dateLiteral],
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
  ],
  format: (value) => formatDateTime(String(value.meta?.iso ?? "")),
});
