import { describe, expect, test } from "bun:test";
import { ANGLE_UNITS } from "@smartput/angle/units";
import { AREA_UNITS } from "@smartput/area/units";
import type { Kind, Vocabulary } from "@smartput/core";
import { BOOLEAN_KIND, BOOLEAN_UNIT, composeLocale } from "@smartput/core";
import { assertLocaleContract } from "@smartput/core/testing";
import { DATARATE_UNITS } from "@smartput/datarate/units";
import { DATASIZE_UNITS } from "@smartput/datasize/units";
import { DURATION_UNITS } from "@smartput/duration/units";
import { ENERGY_UNITS } from "@smartput/energy/units";
import { LENGTH_UNITS } from "@smartput/length/units";
import { english as en } from "@smartput/locale-en";
import { MASS_UNITS } from "@smartput/mass/units";
import measureEn from "@smartput/measure/locale/en";
import { MEASURE_UNITS } from "@smartput/measure/units";
import { NUMBER_UNITS } from "@smartput/number/units";
import { PERCENT_UNITS } from "@smartput/percent/units";
import { POWER_UNITS } from "@smartput/power/units";
import { SPEED_UNITS } from "@smartput/speed/units";
import { TEMPDELTA_UNITS, TEMPERATURE_UNITS } from "@smartput/temperature/units";
import { TEMPO_UNITS } from "@smartput/tempo/units";
import { VOLUME_UNITS } from "@smartput/volume/units";
import {
  Angle,
  Area,
  Datarate,
  Datasize,
  Duration,
  Energy,
  Length,
  Mass,
  Measure,
  // The class is named for its kind, so this one is the JS global's name. The
  // alias is local to this file; nothing here wants the builtin.
  Number as Num,
  Percent,
  Power,
  Speed,
  TempDelta,
  Temperature,
  Tempo,
  Volume,
} from "./class";
import {
  angle,
  area,
  BUILTIN_KINDS,
  datarate,
  datasize,
  duration,
  energy,
  length,
  mass,
  measure,
  number,
  percent,
  power,
  speed,
  tempdelta,
  temperature,
  tempo,
  volume,
} from "./index";
import BUILTIN_EN from "./locale/en";
import {
  parseAngle,
  parseArea,
  parseDatarate,
  parseDatasize,
  parseDuration,
  parseEnergy,
  parseLength,
  parseMass,
  parseMeasure,
  parseNumber,
  parsePercent,
  parsePower,
  parseSpeed,
  parseTempDelta,
  parseTemperature,
  parseTempo,
  parseVolume,
  toMeasure,
} from "./validate";

/**
 * The repo-wide contract every ratio kind owes, table-driven so that adding a
 * kind is adding a row. Each row pairs the `units.ts` table — the single source
 * — with the descriptor that is supposed to be derived from it. Everything
 * below is a way for those two to disagree.
 *
 * `pkg` is the directory under `packages/`, which is also the npm name after
 * `@smartput/`. `temperature` contributes two rows from one package, which is
 * why `pkg` and `id` are separate fields.
 */
/**
 * Just enough of `UnitTable` for the assertions below. Spelled structurally
 * rather than imported from `@smartput/shared`, because every real
 * `UnitTable` satisfies it and importing the type would make the aggregator
 * depend on a package it does not otherwise use — a dependency added for a
 * test is still a dependency in the manifest `check-deps` reads.
 */
type TableLike = {
  readonly canonical: string;
  readonly ratio: Readonly<Record<string, unknown>>;
  /** Present on an affine kind only; its absence is what gives a kind `add`. */
  readonly offset?: Readonly<Record<string, unknown>>;
  readonly alias: Readonly<Record<string, string>>;
};

/** What a parsed result looks like from outside `@smartput/shared`. */
type ParsedLike =
  | { readonly ok: true; readonly value: number; readonly unit: string }
  | { readonly ok: false; readonly code: string };

/**
 * A value instance and its class, structurally, for the same reason `TableLike`
 * is structural: the aggregator must not gain a manifest dependency to run a
 * test. Unit parameters are widened to `string`, which a construct signature
 * checks contravariantly — so the rows below hand their class over as `object`
 * and `classOf` does the one cast, in one place, with this comment on it.
 */
interface ValueLike {
  readonly value: number;
  readonly unit: string;
  to(unit: string): number;
  as(unit: string): ValueLike;
  add?(other: unknown): ValueLike;
  sub?(other: unknown): ValueLike;
  scale?(factor: number): ValueLike;
  negate?(): ValueLike;
  diff?(other: unknown): ValueLike;
  withDpi?(dpi: number): ValueLike;
  equals(other: unknown, epsilon?: number): boolean;
  compare(other: unknown): -1 | 0 | 1;
  toString(): string;
  toJSON(): { value: number; unit: string };
  valueOf(): number;
}

interface ClassLike {
  new (value: number | string, unit: string): ValueLike;
  parse(input: string): ValueLike;
  tryParse(input: string): ValueLike | { ok: false; code: string };
  from(input: unknown): ValueLike;
  readonly kind: string;
  readonly canonical: string;
  readonly units: readonly string[];
}

const classOf = (row: Row): ClassLike => row.cls as unknown as ClassLike;

interface Row {
  id: string;
  pkg: string;
  table: TableLike;
  kind: Kind;
  /** The kind's value class, from the `@smartput/kinds/class` barrel. */
  cls: object;
  /** The kind's free `parse`, from the `@smartput/kinds/validate` barrel. */
  free: (input: string) => ParsedLike;
}

const ROWS: Row[] = [
  {
    id: "angle",
    pkg: "angle",
    table: ANGLE_UNITS,
    kind: angle,
    cls: Angle,
    free: parseAngle,
  },
  { id: "area", pkg: "area", table: AREA_UNITS, kind: area, cls: Area, free: parseArea },
  {
    id: "datarate",
    pkg: "datarate",
    table: DATARATE_UNITS,
    kind: datarate,
    cls: Datarate,
    free: parseDatarate,
  },
  {
    id: "datasize",
    pkg: "datasize",
    table: DATASIZE_UNITS,
    kind: datasize,
    cls: Datasize,
    free: parseDatasize,
  },
  {
    id: "duration",
    pkg: "duration",
    table: DURATION_UNITS,
    kind: duration,
    cls: Duration,
    free: parseDuration,
  },
  {
    id: "energy",
    pkg: "energy",
    table: ENERGY_UNITS,
    kind: energy,
    cls: Energy,
    free: parseEnergy,
  },
  {
    id: "length",
    pkg: "length",
    table: LENGTH_UNITS,
    kind: length,
    cls: Length,
    free: parseLength,
  },
  { id: "mass", pkg: "mass", table: MASS_UNITS, kind: mass, cls: Mass, free: parseMass },
  {
    id: "measure",
    pkg: "measure",
    table: MEASURE_UNITS,
    kind: measure,
    cls: Measure,
    free: parseMeasure,
  },
  {
    id: "number",
    pkg: "number",
    table: NUMBER_UNITS,
    kind: number,
    cls: Num,
    free: parseNumber,
  },
  {
    id: "percent",
    pkg: "percent",
    table: PERCENT_UNITS,
    kind: percent,
    cls: Percent,
    free: parsePercent,
  },
  {
    id: "power",
    pkg: "power",
    table: POWER_UNITS,
    kind: power,
    cls: Power,
    free: parsePower,
  },
  {
    id: "speed",
    pkg: "speed",
    table: SPEED_UNITS,
    kind: speed,
    cls: Speed,
    free: parseSpeed,
  },
  {
    id: "tempdelta",
    pkg: "temperature",
    table: TEMPDELTA_UNITS,
    kind: tempdelta,
    cls: TempDelta,
    free: parseTempDelta,
  },
  {
    id: "temperature",
    pkg: "temperature",
    table: TEMPERATURE_UNITS,
    kind: temperature,
    cls: Temperature,
    free: parseTemperature,
  },
  {
    id: "tempo",
    pkg: "tempo",
    table: TEMPO_UNITS,
    kind: tempo,
    cls: Tempo,
    free: parseTempo,
  },
  {
    id: "volume",
    pkg: "volume",
    table: VOLUME_UNITS,
    kind: volume,
    cls: Volume,
    free: parseVolume,
  },
];

/** The sixteen packages that ship a ratio kind, deduplicated from the rows. */
const PACKAGES = [...new Set(ROWS.map((r) => r.pkg))].sort();

const SUBPATHS = ["./units", "./validate", "./class"] as const;

/**
 * Every row's English vocabulary, keyed by kind id — the words that used to
 * sit on the descriptor as `lexicon`. `measure` is added by hand because it is
 * outside `BUILTIN_EN` for exactly the reason it is outside `BUILTIN_KINDS`.
 */
const WORDS = new Map<string, Vocabulary>(
  [...BUILTIN_EN, measureEn].map((v) => [v.kind, v]),
);

const wordsOf = (row: Row): Vocabulary => {
  const words = WORDS.get(row.id);
  // Not a soft skip: a row with no vocabulary would make the three contracts
  // below vacuously true, which is how a kind loses its words unnoticed.
  if (words === undefined) throw new Error(`no en vocabulary for kind ${row.id}`);
  return words;
};

const ratioUnits = (kind: Kind): string[] => {
  if (kind.value.mode !== "ratio") throw new Error(`${kind.id} is not a ratio kind`);
  return Object.keys(kind.value.units);
};

test("the roster covers every ratio kind exported by the package root", () => {
  // Guards the table itself: a kind added to index.ts but not to ROWS would
  // otherwise be silently exempt from every contract below.
  expect(ROWS.map((r) => r.id).sort()).toEqual([
    "angle",
    "area",
    "datarate",
    "datasize",
    "duration",
    "energy",
    "length",
    "mass",
    "measure",
    "number",
    "percent",
    "power",
    "speed",
    "tempdelta",
    "temperature",
    "tempo",
    "volume",
  ]);
});

describe("every ratio-kind package declares all three subpaths", () => {
  for (const pkg of PACKAGES) {
    test(pkg, async () => {
      const manifest = await Bun.file(
        new URL(`../../${pkg}/package.json`, import.meta.url),
      ).json();
      const exports = manifest.exports ?? {};
      for (const subpath of SUBPATHS) {
        expect(Object.keys(exports)).toContain(subpath);
        // Every condition must resolve to a real file, in the order the repo
        // pins: `bun` first so tsc never sees a sibling .d.ts as an input.
        const entry = exports[subpath];
        expect(Object.keys(entry)).toEqual(["bun", "types", "default"]);
        const source = new URL(
          `../../${pkg}/${entry.bun.replace(/^\.\//, "")}`,
          import.meta.url,
        );
        expect(await Bun.file(source).exists()).toBe(true);
      }
    });
  }
});

describe("units.ts and the descriptor agree", () => {
  for (const row of ROWS) {
    test(`${row.id}: the same unit keys`, () => {
      expect(Object.keys(row.table.ratio).sort()).toEqual(ratioUnits(row.kind).sort());
    });

    test(`${row.id}: the same canonical unit`, () => {
      if (row.kind.value.mode !== "ratio") throw new Error("not a ratio kind");
      expect(row.table.canonical).toBe(row.kind.value.canonical);
      // A canonical unit that is not one of the units is the failure mode this
      // catches on a typo'd rename.
      expect(Object.keys(row.table.ratio)).toContain(row.table.canonical);
    });

    test(`${row.id}: every vocabulary unit is a table unit`, () => {
      const units = new Set(Object.keys(row.table.ratio));
      for (const unit of Object.keys(wordsOf(row).units)) {
        expect({ unit, known: units.has(unit) }).toEqual({ unit, known: true });
      }
    });
  }
});

describe("the alias map is well formed", () => {
  for (const row of ROWS) {
    test(`${row.id}: every alias points at a real unit`, () => {
      const units = new Set(Object.keys(row.table.ratio));
      for (const [alias, unit] of Object.entries(row.table.alias)) {
        expect({ alias, unit, known: units.has(unit) }).toEqual({
          alias,
          unit,
          known: true,
        });
      }
    });

    test(`${row.id}: every unit is its own alias`, () => {
      // `format` emits `${value}${unit}`, so a unit that is not an alias of
      // itself produces output its own parser rejects in strict mode.
      for (const unit of Object.keys(row.table.ratio)) {
        expect({ unit, self: row.table.alias[unit] }).toEqual({ unit, self: unit });
      }
    });

    test(`${row.id}: every vocabulary alias appears in the table`, () => {
      // The derivation direction that matters: the vocabulary is built from the
      // table, so an alias with no table entry means someone hand-edited
      // `locale/en` and the micro path can no longer parse what the engine
      // accepts.
      for (const [unit, words] of Object.entries(wordsOf(row).units)) {
        for (const alias of words.aliases) {
          expect({ alias, unit: row.table.alias[alias] }).toEqual({ alias, unit });
        }
      }
    });
  }
});

/**
 * The regression that shipped once: deriving the vocabulary from the table made
 * every unit key its own alias, which put `in` — core's conversion keyword —
 * into `registry.aliasIndex`. `lex` never emits it as a word, so the entry was
 * unreachable, but `MatchCtx.isUnitAlias` reads the index directly and
 * `@smartput/datetime`'s accept-gate uses it to refuse a phrase whose words are
 * all unit aliases. "in 3 days" stopped being a date.
 *
 * The reserved set is read off the locale rather than hardcoded, so adding a
 * keyword to `locale/en` re-checks all seventeen tables for free.
 */
describe("no vocabulary alias collides with a locale keyword", () => {
  const reserved = new Set(Object.values(en.keywords ?? {}).flat());

  test("the locale still defines keywords to check against", () => {
    expect(reserved.size).toBeGreaterThan(0);
    expect(reserved.has("in")).toBe(true);
  });

  for (const row of ROWS) {
    test(row.id, () => {
      for (const words of Object.values(wordsOf(row).units)) {
        for (const alias of words.aliases) {
          expect({ alias, reserved: reserved.has(alias) }).toEqual({
            alias,
            reserved: false,
          });
        }
      }
    });
  }

  test("length still keeps `in` on the micro path", () => {
    // The exclusion is vocabulary-only. Dropping it from the table too would break
    // the strict round-trip of `formatLength(v, "in")`.
    expect(LENGTH_UNITS.alias.in).toBe("in");
  });
});

/**
 * The whole roster against the whole English language, in one call — spec §9's
 * four checks, run over the pair a consumer actually wires up. The three
 * describes above check each vocabulary against its own `units.ts`; this checks
 * them against `english`, which is the half a table cannot see: whether every
 * grammatical key `selectForm` will ask for at runtime exists in the `forms`
 * table it will index.
 *
 * It is a single test rather than one per kind because that is how the
 * assertion reports: it collects every problem across every unit and names them
 * all in one message, so a gap in the sixteenth vocabulary is visible on the
 * first run rather than on the sixteenth.
 */
test("the en vocabularies satisfy the locale contract", () => {
  assertLocaleContract(composeLocale(en, BUILTIN_EN), BUILTIN_KINDS, {
    // `boolean`'s single unit is a sentinel with no word in any language, and
    // that is the design rather than an omission: every value of the kind
    // prints through its `format` hook ("true"/"false"), the unit id never
    // reaches a user, and `@smartput/boolean` ships no vocabulary at all. This
    // is I10's degradation being taken deliberately — the one case `skip`
    // exists for.
    skip: [`${BOOLEAN_KIND}:${BOOLEAN_UNIT}`],
  });
});

/**
 * Spec §12's immutability suite: "Shared, run against every class."
 *
 * It was never built, and ten of the thirteen classes were constructed by no
 * test at all — which is how `Number.parse("30")` shipped throwing
 * `missing-unit` on the one input spec §7.1 says the kind exists for, while
 * `parseNumber("30")` returned 30. Every assertion below runs against all
 * seventeen rows, so a kind cannot be added without being covered.
 *
 * Sample inputs are derived from each table rather than listed per kind: a unit
 * is its own alias (asserted above), so `1<canonical>` parses for every kind,
 * and adding a kind adds no fixture to forget.
 */
describe("every class", () => {
  const sampleOf = (row: Row) => `1${row.table.canonical}`;

  for (const row of ROWS) {
    const V = classOf(row);
    const sample = sampleOf(row);

    test(`${row.id}: parses its own canonical sample`, () => {
      const v = V.parse(sample);
      expect({ id: row.id, value: v.value, unit: v.unit }).toEqual({
        id: row.id,
        value: 1,
        unit: row.table.canonical,
      });
      expect(V.kind).toBe(row.id);
      expect(V.canonical).toBe(row.table.canonical);
      expect([...V.units].sort()).toEqual(Object.keys(row.table.ratio).sort());
    });

    test(`${row.id}: the class and the free function agree, input for input`, () => {
      // The assertion that was missing. Both paths read the same table, but
      // only the free wrappers were baking in the kind's own parse defaults, so
      // the two disagreed on exactly the inputs a default exists for.
      const inputs = [
        sample,
        ` 2 ${row.table.canonical} `,
        `-3${row.table.canonical}`,
        "1",
        "1zzz",
        "",
      ];
      for (const input of inputs) {
        const free = row.free(input);
        const cls = V.tryParse(input);
        const clsOk = !("ok" in cls);
        expect({ input, ok: clsOk }, `${row.id} ${input}`).toEqual({
          input,
          ok: free.ok,
        });
        if (!free.ok || !clsOk) continue;
        const v = cls as ValueLike;
        expect({ input, value: v.value, unit: v.unit }, `${row.id} ${input}`).toEqual({
          input,
          value: free.value,
          unit: free.unit,
        });
      }
    });

    test(`${row.id}: instances are frozen and mutation throws`, () => {
      const v = V.parse(sample);
      expect(Object.isFrozen(v)).toBe(true);
      // Test files are modules, so this is strict mode: an assignment to a
      // frozen own property throws rather than silently doing nothing.
      expect(() => {
        (v as { value: number }).value = 99;
      }).toThrow();
      expect(() => {
        (v as { unit: string }).unit = "nope";
      }).toThrow();
      expect(() => {
        (v as unknown as Record<string, unknown>).extra = 1;
      }).toThrow();
      expect(v.value).toBe(1);
      // `value` and `unit` are own properties, not accessors on a prototype
      // that could be swapped out from under them.
      expect(Object.keys(v).sort()).toEqual(["unit", "value"]);
    });

    test(`${row.id}: no method returns this`, () => {
      const v = V.parse(sample);
      const results: ValueLike[] = [v.as(row.table.canonical)];
      if (v.add) results.push(v.add(sample));
      if (v.sub) results.push(v.sub(sample));
      if (v.scale) results.push(v.scale(2));
      if (v.negate) results.push(v.negate());
      if (v.diff) results.push(v.diff(sample));
      if (v.withDpi) results.push(v.withDpi(144));
      // The `as` on the same unit is the one most likely to be "optimised" into
      // returning `this`; it is first in the list for that reason.
      for (const r of results) {
        expect(r === v, row.id).toBe(false);
        expect(Object.isFrozen(r), row.id).toBe(true);
      }
      expect(results.length).toBeGreaterThan(1);
    });

    test(`${row.id}: the table decides which methods exist`, () => {
      const v = V.parse(sample);
      const affine = row.table.offset !== undefined;
      // An affine kind has `diff` and no `scale`: 20°C doubled means nothing.
      // `temperature` adds a delta-only `add` back on top, which is why `add`
      // is not part of this assertion.
      expect({ id: row.id, diff: typeof v.diff, scale: typeof v.scale }).toEqual({
        id: row.id,
        diff: affine ? "function" : "undefined",
        scale: affine ? "undefined" : "function",
      });
      // `withDpi` exists exactly where a ratio is a function of context.
      const dynamic = Object.values(row.table.ratio).some((r) => typeof r === "function");
      expect({ id: row.id, withDpi: typeof v.withDpi }).toEqual({
        id: row.id,
        withDpi: dynamic ? "function" : "undefined",
      });
    });

    test(`${row.id}: to/as/valueOf agree, and a same-unit conversion is exact`, () => {
      const v = new V(7, row.table.canonical);
      for (const unit of V.units) {
        const there = v.to(unit);
        expect(Number.isFinite(there), `${row.id} ${unit}`).toBe(true);
        expect(v.as(unit).value, `${row.id} ${unit}`).toBe(there);
        // Back again, through the class, lands where it started.
        expect(v.as(unit).to(row.table.canonical), `${row.id} ${unit}`).toBeCloseTo(7, 9);
      }
      expect(v.to(row.table.canonical)).toBe(7);
      expect(v.valueOf()).toBe(new V(7, row.table.canonical).valueOf());
      expect(v.equals(v)).toBe(true);
      expect(v.compare(v)).toBe(0);
      expect(v.toJSON()).toEqual({ value: 7, unit: row.table.canonical });
    });

    test(`${row.id}: toString round-trips through parse`, () => {
      const v = new V(7.5, row.table.canonical);
      const again = V.parse(v.toString());
      expect({ value: again.value, unit: again.unit }).toEqual({
        value: 7.5,
        unit: row.table.canonical,
      });
    });

    test(`${row.id}: an unknown unit is refused by name`, () => {
      expect(() => new V(1, "definitely-not-a-unit")).toThrow(/unknown-unit/);
      expect(() => new V(Number.NaN, row.table.canonical)).toThrow(/nan/);
    });
  }
});

/**
 * Spec §8: "a `Measure` additionally takes a `dpi` in its constructor options
 * and exposes `.withDpi(n)`." It did neither — a third constructor argument was
 * accepted and ignored, so every instance was permanently 96 dpi while the free
 * path honoured `ctx.dpi`. These are the assertions that say otherwise.
 */
describe("Measure carries a dpi", () => {
  const at144 = (10 / 144) * 25.4;

  test("the constructor takes one", () => {
    expect(new Measure(10, "px", { dpi: 144 }).to("mm")).toBeCloseTo(at144, 12);
    expect(new Measure(10, "px").to("mm")).toBeCloseTo((10 / 96) * 25.4, 12);
  });

  test("withDpi returns a new instance at that dpi", () => {
    const base = Measure.parse("10px");
    const dense = base.withDpi(144);
    expect(dense).not.toBe(base);
    expect(dense.to("mm")).toBeCloseTo(at144, 12);
    // The original is untouched — §8's immutability rule, on the new method.
    expect(base.to("mm")).toBeCloseTo((10 / 96) * 25.4, 12);
  });

  test("parse takes one through ctx, and it survives a chain", () => {
    expect(Measure.parse("10px", { ctx: { dpi: 144 } }).to("mm")).toBeCloseTo(at144, 12);
    // `as` and the arithmetic keep the context, or a dpi would silently revert
    // to 96 at the first conversion.
    expect(Measure.parse("10px").withDpi(144).as("inch").to("mm")).toBeCloseTo(at144, 12);
    expect(Measure.parse("1inch").withDpi(144).add("144px").to("inch")).toBeCloseTo(
      2,
      12,
    );
    expect(Measure.parse("10px").withDpi(144).valueOf()).toBeCloseTo(10 / 144, 12);
  });

  test("the class agrees with the free path at the same dpi", () => {
    for (const dpi of [96, 144, 300]) {
      expect(Measure.parse("10px").withDpi(dpi).to("mm"), String(dpi)).toBe(
        parseMeasureTo(dpi),
      );
    }
  });
});

/** `toMeasure` at a dpi, as the free path spells it. */
function parseMeasureTo(dpi: number): number {
  const parsed = parseMeasure("10px");
  if (!parsed.ok) throw new Error("10px must parse");
  return toMeasure(parsed, "mm", { ctx: { dpi } }) as number;
}

/**
 * Spec §7.1: "`defaultUnit: \"one\"` is baked into the wrapper, so a bare
 * number parses in both modes". It was baked into the free wrappers only.
 */
test("Number parses a bare number, the input the kind exists for", () => {
  expect(Num.parse("30").value).toBe(30);
  expect(Num.from("30").value).toBe(30);
  expect(Num.tryParse("30")).toMatchObject({ value: 30, unit: "one" });
  expect(Num.parse("30").unit).toBe("one");
  // Strict mode has no bare-number fallback on either path, and the class must
  // not invent one: this is `missing-unit` for `parseNumber` too.
  expect(() => Num.parse("30", { mode: "strict" })).toThrow(/missing-unit/);
  expect(parseNumber("30", { mode: "strict" })).toMatchObject({ code: "missing-unit" });
});
