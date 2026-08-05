import { describe, expect, test } from "bun:test";
import { ANGLE_UNITS } from "@smartput/angle/units";
import { AREA_UNITS } from "@smartput/area/units";
import { Decimal } from "@smartput/core";
import { DATASIZE_UNITS } from "@smartput/datasize/units";
import { DURATION_UNITS } from "@smartput/duration/units";
import { LENGTH_UNITS } from "@smartput/length/units";
import { MASS_UNITS } from "@smartput/mass/units";
import { MEASURE_UNITS } from "@smartput/measure/units";
import { NUMBER_UNITS } from "@smartput/number/units";
import { PERCENT_UNITS } from "@smartput/percent/units";
import { SPEED_UNITS } from "@smartput/speed/units";
import { TEMPDELTA_UNITS, TEMPERATURE_UNITS } from "@smartput/temperature/units";
import { VOLUME_UNITS } from "@smartput/volume/units";

/**
 * Every ratio in the repo, re-derived from its definition and compared to the
 * string that ships.
 *
 * This file exists because nothing else did this. The per-kind suites test
 * conversion identity (A→B→A, which a wrong ratio cancels out of), round trips
 * (same), and "cross-path agreement" between the micro path and the engine —
 * and both of those read the *same* string out of the *same* table, so a
 * transposed or truncated constant agrees with itself perfectly and the suite
 * stays green. `speed.knot` shipped as "0.514444" — the true 1852/3600
 * truncated at six decimals, 8.6e-7 low — through 1133 passing tests.
 *
 * So the assertions below never mention the stored string on both sides. Each
 * one states the *definition* (a nautical mile is 1852 m, an inch is 25.4 mm
 * exactly, an acre is 4840 square yards) and computes it at precision 60, well
 * clear of both the 28 digits the engine is configured for and the 30 the
 * longest strings carry. The stored string must then be that value correctly
 * rounded to however many significant digits it claims.
 *
 * `Decimal.clone` rather than the shared instance: `@smartput/core/decimal`
 * sets precision 28 globally, and checking a 28-digit string with 28-digit
 * arithmetic would be marking your own homework.
 */
const D = Decimal.clone({ precision: 60 });

const PI = D.acos(-1);

/** Digits that carry information: no sign, no point, no leading zeros. */
const significantDigits = (s: string): number =>
  s.replace(/^-/, "").replace(".", "").replace(/^0+/, "").length;

type Table = {
  readonly canonical: string;
  readonly ratio: Readonly<Record<string, unknown>>;
  readonly offset?: Readonly<Record<string, unknown>>;
};

interface Kind {
  id: string;
  table: Table;
  /** Every unit's ratio, derived from its definition and nothing else. */
  defs: Record<string, InstanceType<typeof D>>;
  /** Units with no constant ratio, checked for being functions instead. */
  dynamic?: string[];
  offsets?: Record<string, string>;
  /**
   * The canonical unit's own ratio, "1" everywhere but `percent`. Stated per
   * kind rather than assumed, because percent's exception is deliberate: its
   * canonical *magnitude* is the plain 0-1 ratio (spec §7.2, so `20%` is 0.2
   * and behaves like a number), while its only unit key is `%`.
   */
  canonicalRatio?: string;
}

const d = (n: Decimal.Value) => new D(n);

// Definitions used by more than one kind, each stated once.
const INCH_MM = d(254).div(10); // the international inch: 25.4 mm, exactly
const YARD_M = INCH_MM.times(36).div(1000); // 36 inches
const MILE_M = YARD_M.times(1760);
const POUND_G = d("453.59237"); // the international avoirdupois pound, exactly
const NAUTICAL_MILE_M = d(1852); // exactly, by definition
const HOUR_S = d(3600);

const KINDS: Kind[] = [
  {
    id: "angle",
    table: ANGLE_UNITS,
    defs: {
      rad: d(1),
      deg: PI.div(180),
      grad: PI.div(200),
      turn: PI.times(2),
    },
  },
  {
    id: "area",
    table: AREA_UNITS,
    defs: {
      m2: d(1),
      cm2: d(1).div(100).pow(2),
      km2: d(1000).pow(2),
      hectare: d(100).pow(2),
      // An acre is 4840 square yards.
      acre: YARD_M.pow(2).times(4840),
    },
  },
  {
    id: "datasize",
    table: DATASIZE_UNITS,
    defs: {
      b: d(1),
      kb: d(1000).pow(1),
      mb: d(1000).pow(2),
      gb: d(1000).pow(3),
      tb: d(1000).pow(4),
      kib: d(1024).pow(1),
      mib: d(1024).pow(2),
      gib: d(1024).pow(3),
      tib: d(1024).pow(4),
    },
  },
  {
    id: "duration",
    table: DURATION_UNITS,
    defs: {
      ms: d(1).div(1000),
      s: d(1),
      min: d(60),
      h: HOUR_S,
      d: HOUR_S.times(24),
      wk: HOUR_S.times(24).times(7),
    },
  },
  {
    id: "length",
    table: LENGTH_UNITS,
    defs: {
      mm: d(1).div(1000),
      cm: d(1).div(100),
      m: d(1),
      km: d(1000),
      in: INCH_MM.div(1000),
      ft: INCH_MM.times(12).div(1000),
      yd: YARD_M,
      mi: MILE_M,
    },
  },
  {
    id: "mass",
    table: MASS_UNITS,
    defs: {
      mg: d(1).div(1000),
      g: d(1),
      kg: d(1000),
      t: d(1000).times(1000),
      oz: POUND_G.div(16), // sixteen ounces to the pound
      lb: POUND_G,
    },
  },
  {
    id: "measure",
    table: MEASURE_UNITS,
    // Canonical is the inch, so each ratio is "how many inches is one of
    // these": a millimetre is 1/25.4 inch, a point is 1/72, a pica is 1/6.
    defs: {
      inch: d(1),
      mm: d(1).div(INCH_MM),
      cm: d(10).div(INCH_MM),
      pt: d(1).div(72),
      pc: d(1).div(6),
    },
    dynamic: ["px"],
  },
  { id: "number", table: NUMBER_UNITS, defs: { one: d(1) } },
  {
    id: "percent",
    table: PERCENT_UNITS,
    defs: { "%": d(1).div(100) },
    canonicalRatio: "0.01",
  },
  {
    id: "speed",
    table: SPEED_UNITS,
    // Every one of these is a distance per hour, in metres per second.
    defs: {
      mps: d(1),
      kph: d(1000).div(HOUR_S),
      mph: MILE_M.div(HOUR_S),
      knot: NAUTICAL_MILE_M.div(HOUR_S),
    },
  },
  {
    id: "tempdelta",
    table: TEMPDELTA_UNITS,
    // A degree Fahrenheit is 5/9 of a degree Celsius; a kelvin is one Celsius
    // degree exactly, the offset being the whole difference.
    defs: { c: d(1), f: d(5).div(9), k: d(1) },
  },
  {
    id: "temperature",
    table: TEMPERATURE_UNITS,
    defs: { c: d(1), f: d(5).div(9), k: d(1) },
    offsets: { f: "-32", k: "-273.15" },
  },
  {
    id: "volume",
    table: VOLUME_UNITS,
    defs: {
      l: d(1),
      ml: d(1).div(1000),
      m3: d(1000),
      // A US liquid gallon is 231 cubic inches, and a litre is 1000 cm³.
      gal: INCH_MM.div(10).pow(3).times(231).div(1000),
      pint: INCH_MM.div(10).pow(3).times(231).div(1000).div(8),
    },
  },
];

test("every kind in the repo is covered here", () => {
  // Otherwise a new kind's ratios would simply not be checked, which is the
  // state this file was written to end.
  expect(KINDS.map((k) => k.id).sort()).toEqual([
    "angle",
    "area",
    "datasize",
    "duration",
    "length",
    "mass",
    "measure",
    "number",
    "percent",
    "speed",
    "tempdelta",
    "temperature",
    "volume",
  ]);
});

describe("every ratio is its definition, correctly rounded", () => {
  for (const kind of KINDS) {
    const units = Object.keys(kind.table.ratio);

    test(`${kind.id}: the definitions cover the table exactly`, () => {
      expect([...Object.keys(kind.defs), ...(kind.dynamic ?? [])].sort()).toEqual(
        units.sort(),
      );
    });

    for (const [unit, def] of Object.entries(kind.defs)) {
      test(`${kind.id}.${unit}`, () => {
        const stored = kind.table.ratio[unit];
        expect(typeof stored, `${kind.id}.${unit} must be a decimal string`).toBe(
          "string",
        );
        if (typeof stored !== "string") return;
        // The string must be the definition rounded to the digit count it
        // itself claims — so shortening a string is allowed, mistyping one is
        // not, and truncating one (knot, "0.514444" against a 4 in the next
        // place) fails on the last digit.
        expect(def.toSignificantDigits(significantDigits(stored)).toString()).toBe(
          stored,
        );
      });
    }

    for (const unit of kind.dynamic ?? []) {
      test(`${kind.id}.${unit} is dynamic, not a constant`, () => {
        expect(typeof kind.table.ratio[unit]).toBe("function");
      });
    }

    test(`${kind.id}: the canonical unit's ratio is the one stated here`, () => {
      const expected = kind.canonicalRatio ?? "1";
      expect(kind.table.ratio[kind.table.canonical]).toBe(expected);
      expect(kind.defs[kind.table.canonical]?.toString()).toBe(expected);
    });

    const offsets = kind.offsets;
    if (offsets !== undefined) {
      test(`${kind.id}: the offsets are the scales' own zero points`, () => {
        // 0°F is -32 Celsius degrees from the Celsius zero before scaling, and
        // 0 K is -273.15. Written as the definition, not copied from the table.
        expect(kind.table.offset).toEqual(offsets);
        expect(new D(offsets.k ?? "").plus("273.15").isZero()).toBe(true);
        expect(new D(offsets.f ?? "").plus(32).isZero()).toBe(true);
      });
    }
  }
});

/**
 * The engine's configured precision (`Decimal.set({ precision: 28 })` in
 * `@smartput/core/decimal`). A ratio that cannot be written exactly has to
 * reach at least this far, or the engine's arithmetic starts from a number
 * already worse than the arithmetic itself.
 */
const ENGINE_PRECISION = 28;

test("a ratio is either exact or carries the full engine precision", () => {
  // This is the assertion the knot defect needed and the one "correctly
  // rounded" above does *not* give: "0.514444" is a perfectly correct rounding
  // of 1852/3600 — to six digits. Six digits is the bug. So the question here
  // is not how the string rounds but whether it stops early: a string that is
  // not the exact value must carry 28 significant digits, and "0.514444" has
  // six.
  let exactCount = 0;
  let approximateCount = 0;
  for (const kind of KINDS) {
    for (const [unit, def] of Object.entries(kind.defs)) {
      const stored = kind.table.ratio[unit];
      if (typeof stored !== "string") continue;
      // `def` is carried at precision 60, so equality here means the string
      // reproduces the definition and not merely its leading digits.
      if (new D(stored).equals(def)) {
        exactCount += 1;
        continue;
      }
      approximateCount += 1;
      expect({
        unit: `${kind.id}.${unit}`,
        enough: significantDigits(stored) >= ENGINE_PRECISION,
      }).toEqual({ unit: `${kind.id}.${unit}`, enough: true });
    }
  }
  // Sixty constant ratios across thirteen tables, plus `measure.px`, which is a
  // function and is checked above instead. Nine of the sixty are irrational or
  // non-terminating: angle's three, measure's four, speed's kph and knot, and
  // temperature/tempdelta's `f` twice over — eleven in total.
  expect({ exactCount, approximateCount }).toEqual({
    exactCount: 49,
    approximateCount: 11,
  });
});
