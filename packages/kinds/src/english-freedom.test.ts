import { describe, expect, test } from "bun:test";
import type { Kind } from "@smartput/core";
import { Glob } from "bun";
import {
  angle,
  area,
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

/**
 * What keeps I1 true a year from now: a kind descriptor is language-free, and
 * the only place an English word may appear in a kind package is `src/locale/`.
 *
 * The word list is unit *names*, not every English word — a doc comment is
 * prose and always will be. So the grep is over string literals: a source line
 * containing a quoted member of the list, outside `src/locale/` and outside a
 * comment, is a word that escaped its vocabulary.
 *
 * Two exemptions, both of them the difference between a word and a name:
 *
 * - A **registry identifier** is not an English word (ruling R2 — "the unit key
 *   is the registry's identifier"). `percent`'s kind id is spelled `percent`
 *   and `measure`'s canonical unit is spelled `inch`; they stay on the kind in
 *   every language, because renaming them would rename the thing rather than
 *   translate it. So a literal is only an offender when it is *not* one of the
 *   ids the package's own kinds declare. That set is read from the kinds
 *   themselves rather than hand-listed, so it cannot go stale.
 * - `units.ts` holds the `alias` map the vocabularies derive from — the single
 *   source of English aliases the validate spec pins (§12). The table is data a
 *   vocabulary reads, not words the kind speaks, and moving it into
 *   `src/locale/` would give the micro path (`@smartput/<kind>/units`, which
 *   must not link a locale) a second copy.
 */
const WORDS = [
  "kilogram",
  "gram",
  "milligram",
  "tonne",
  "ounce",
  "pound",
  "metre",
  "meter",
  "kilometre",
  "kilometer",
  "mile",
  "inch",
  "foot",
  "yard",
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "degree",
  "radian",
  "turn",
  "byte",
  "kilobyte",
  "megabyte",
  "gigabyte",
  "watt",
  "joule",
  "calorie",
  "litre",
  "liter",
  "gallon",
  "celsius",
  "fahrenheit",
  "kelvin",
  "percent",
];

/** Package directory to the kinds it defines. */
const PACKAGES: Readonly<Record<string, readonly Kind[]>> = {
  angle: [angle],
  area: [area],
  datarate: [datarate],
  datasize: [datasize],
  duration: [duration],
  energy: [energy],
  length: [length],
  mass: [mass],
  measure: [measure],
  number: [number],
  percent: [percent],
  power: [power],
  speed: [speed],
  temperature: [temperature, tempdelta],
  tempo: [tempo],
  volume: [volume],
};

const ROOT = new URL("../../..", import.meta.url).pathname;

/** Every kind id and unit id a package's own kinds declare. */
function identifiers(kinds: readonly Kind[]): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const kind of kinds) {
    ids.add(kind.id);
    const spec = kind.value;
    if (spec.mode === "ratio") {
      ids.add(spec.canonical);
      for (const unit of Object.keys(spec.units)) ids.add(unit);
    } else {
      for (const unit of spec.units ?? []) ids.add(unit);
    }
  }
  return ids;
}

/** Files the checks do not read: vocabularies, tests, and the alias table. */
const exempt = (file: string): boolean =>
  file.includes("/locale/") || file.endsWith(".test.ts") || file.endsWith("/units.ts");

/**
 * Codepoint-wise rather than `/[^\x00-\x7F]/`, which biome refuses for naming
 * control characters inside a regex. Same claim, and it reads as the claim.
 */
const hasNonAscii = (text: string): boolean =>
  [...text].some((ch) => (ch.codePointAt(0) ?? 0) > 0x7f);

/** Every quoted string literal on one line of source. */
function literals(code: string): string[] {
  return [...code.matchAll(/(["'])((?:\\.|(?!\1)[^\\])*)\1/g)].map((m) => m[2] ?? "");
}

async function sources(pkg: string): Promise<{ file: string; text: string }[]> {
  const out: { file: string; text: string }[] = [];
  for (const file of new Glob(`packages/${pkg}/src/**/*.ts`).scanSync(ROOT)) {
    if (exempt(file)) continue;
    out.push({
      file,
      text: await Bun.file(new URL(`../../../${file}`, import.meta.url)).text(),
    });
  }
  return out;
}

describe("english freedom", () => {
  for (const [pkg, kinds] of Object.entries(PACKAGES)) {
    test(`${pkg} names no English unit word outside src/locale`, async () => {
      const ids = identifiers(kinds);
      const offenders: string[] = [];
      for (const { file, text } of await sources(pkg)) {
        for (const line of text.split("\n")) {
          const code = line.replace(/\/\/.*$/, "").replace(/^\s*\*.*$/, "");
          for (const literal of literals(code)) {
            if (ids.has(literal)) continue;
            // Anchored at the opening quote, as an alias, symbol or form
            // always is. Unanchored would catch prose that merely contains a
            // word — "the second operand was read as a difference" is an
            // assumption message, not a unit named "second".
            if (WORDS.some((word) => literal.startsWith(word))) {
              offenders.push(`${file}: ${line.trim()}`);
            }
          }
        }
      }
      expect(offenders).toEqual([]);
    });
  }

  test("no kind package source is non-ASCII outside src/locale", async () => {
    const offenders: string[] = [];
    for (const pkg of Object.keys(PACKAGES)) {
      for (const { file, text } of await sources(pkg)) {
        // Symbols the kind legitimately keeps: none. `°`, `²`, `µ` are all
        // vocabulary now.
        const stripped = text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
        if (hasNonAscii(stripped)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});
