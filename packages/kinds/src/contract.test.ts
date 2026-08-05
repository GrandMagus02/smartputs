import { describe, expect, test } from "bun:test";
import { ANGLE_UNITS } from "@smartput/angle/units";
import { AREA_UNITS } from "@smartput/area/units";
import type { Kind, UnitLexeme } from "@smartput/core";
import en from "@smartput/core/locale/en";
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

import {
  angle,
  area,
  datasize,
  duration,
  length,
  mass,
  measure,
  number,
  percent,
  speed,
  tempdelta,
  temperature,
  volume,
} from "./index";

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
 * rather than imported from `@smartput/validate`, because every real
 * `UnitTable` satisfies it and importing the type would make the aggregator
 * depend on a package it does not otherwise use — a dependency added for a
 * test is still a dependency in the manifest `check-deps` reads.
 */
type TableLike = {
  readonly canonical: string;
  readonly ratio: Readonly<Record<string, unknown>>;
  readonly alias: Readonly<Record<string, string>>;
};

interface Row {
  id: string;
  pkg: string;
  table: TableLike;
  kind: Kind;
}

const ROWS: Row[] = [
  { id: "angle", pkg: "angle", table: ANGLE_UNITS, kind: angle },
  { id: "area", pkg: "area", table: AREA_UNITS, kind: area },
  { id: "datasize", pkg: "datasize", table: DATASIZE_UNITS, kind: datasize },
  { id: "duration", pkg: "duration", table: DURATION_UNITS, kind: duration },
  { id: "length", pkg: "length", table: LENGTH_UNITS, kind: length },
  { id: "mass", pkg: "mass", table: MASS_UNITS, kind: mass },
  { id: "measure", pkg: "measure", table: MEASURE_UNITS, kind: measure },
  { id: "number", pkg: "number", table: NUMBER_UNITS, kind: number },
  { id: "percent", pkg: "percent", table: PERCENT_UNITS, kind: percent },
  { id: "speed", pkg: "speed", table: SPEED_UNITS, kind: speed },
  { id: "tempdelta", pkg: "temperature", table: TEMPDELTA_UNITS, kind: tempdelta },
  { id: "temperature", pkg: "temperature", table: TEMPERATURE_UNITS, kind: temperature },
  { id: "volume", pkg: "volume", table: VOLUME_UNITS, kind: volume },
];

/** The twelve packages that ship a ratio kind, deduplicated from the rows. */
const PACKAGES = [...new Set(ROWS.map((r) => r.pkg))].sort();

const SUBPATHS = ["./units", "./validate", "./class"] as const;

const aliasesOf = (lexeme: UnitLexeme | string[]): string[] =>
  Array.isArray(lexeme) ? lexeme : lexeme.aliases;

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

    test(`${row.id}: every lexicon unit is a table unit`, () => {
      const lexicon = row.kind.lexicon ?? {};
      const units = new Set(Object.keys(row.table.ratio));
      for (const unit of Object.keys(lexicon)) {
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

    test(`${row.id}: every lexicon alias appears in the table`, () => {
      // The derivation direction that matters: the descriptor is built from the
      // table, so a lexicon alias with no table entry means someone hand-edited
      // the descriptor and the micro path can no longer parse what the engine
      // accepts.
      const lexicon = row.kind.lexicon ?? {};
      for (const [unit, lexeme] of Object.entries(lexicon)) {
        for (const alias of aliasesOf(lexeme)) {
          expect({ alias, unit: row.table.alias[alias] }).toEqual({ alias, unit });
        }
      }
    });
  }
});

/**
 * The regression that shipped once: deriving the lexicon from the table made
 * every unit key its own alias, which put `in` — core's conversion keyword —
 * into `registry.aliasIndex`. `lex` never emits it as a word, so the entry was
 * unreachable, but `MatchCtx.isUnitAlias` reads the index directly and
 * `@smartput/datetime`'s accept-gate uses it to refuse a phrase whose words are
 * all unit aliases. "in 3 days" stopped being a date.
 *
 * The reserved set is read off the locale rather than hardcoded, so adding a
 * keyword to `locale/en` re-checks all thirteen tables for free.
 */
describe("no lexicon alias collides with a locale keyword", () => {
  const reserved = new Set(Object.values(en.keywords ?? {}).flat());

  test("the locale still defines keywords to check against", () => {
    expect(reserved.size).toBeGreaterThan(0);
    expect(reserved.has("in")).toBe(true);
  });

  for (const row of ROWS) {
    test(row.id, () => {
      const lexicon = row.kind.lexicon ?? {};
      for (const lexeme of Object.values(lexicon)) {
        for (const alias of aliasesOf(lexeme)) {
          expect({ alias, reserved: reserved.has(alias) }).toEqual({
            alias,
            reserved: false,
          });
        }
      }
    });
  }

  test("length still keeps `in` on the micro path", () => {
    // The exclusion is lexicon-only. Dropping it from the table too would break
    // the strict round-trip of `formatLength(v, "in")`.
    expect(LENGTH_UNITS.alias.in).toBe("in");
  });
});
