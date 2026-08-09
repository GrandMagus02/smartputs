import { expect, test } from "bun:test";
import { parseOffsetZone } from "./offset";
import { zoneSymbol } from "./symbol";
import { ZONES } from "./zones";

/**
 * The corpus for `@smartput/timezone`: every word or written offset a person
 * types for a zone, and the zone id and symbol it lands on.
 *
 * This package ships no kind and no engine — it is two tables and a parser —
 * so the corpus is read directly rather than through `evaluate`. That is the
 * point of the package: a form field offering a zone picker should not install
 * chrono and Temporal to find out that `jst` is `Asia/Tokyo`.
 *
 * The alias index is rebuilt here from `ZONES` rather than imported, because
 * the package publishes the table and not a lookup — a consumer who wants one
 * builds exactly this, and a row that stopped resolving would mean the shipped
 * table changed under them.
 *
 * One corpus file, where every kind package in the repo now has two, and the
 * reason is in the table rather than in this test. A zone's words here are its
 * IANA id, its abbreviation and a handful of English spellings, so a `uk.tsv`
 * would have nothing to record until `ZONES` carries a Cyrillic alias — and it
 * cannot get one cheaply: the aliases are what a bundle pays for, and this
 * package exists to be the small one. The written-offset half (`гмт+3`) is
 * likewise Latin because `parseOffsetZone` matches `gmt`/`utc` and no other
 * spelling. `@smartput/datetime/locale/uk` is where a Ukrainian name for
 * `Europe/Kyiv` belongs, since that is a vocabulary and this is a table.
 *
 * It also loads its own corpus rather than using `@smartput/core/testing`'s
 * `Corpora`, for the reason above the fold: this package declares zero
 * dependencies, and the harness would be the first edge for a loop of eight
 * lines.
 */
const byAlias = new Map<string, string>();
for (const [id, def] of Object.entries(ZONES)) {
  for (const alias of def.aliases) byAlias.set(alias, id);
}

const raw = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();

const rows = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\t"));

test("the corpus has rows", () => {
  expect(rows.length).toBeGreaterThan(10);
});

for (const [input, reading, zone, length, symbol] of rows) {
  test(`corpus: ${input} (${reading})`, () => {
    if (reading === "word") {
      expect(byAlias.get(input as string)).toBe(zone as string);
      expect(zoneSymbol(zone as string)).toBe(symbol as string);
      return;
    }

    const match = parseOffsetZone(input as string);
    if (zone === "-") {
      expect(match).toBeNull();
      return;
    }
    expect(match).not.toBeNull();
    if (match === null) return;
    expect(match.zone).toBe(zone as string);
    expect(match.length).toBe(Number(length));
    expect(zoneSymbol(match.zone)).toBe(symbol as string);
  });
}

/**
 * A corpus of things that parse would pass against a parser that parsed
 * anything, so the refusals are counted rather than trusted to survive the
 * next edit of the table.
 */
test("the corpus records refusals as well as answers", () => {
  expect(rows.filter((r) => r[2] === "-").length).toBeGreaterThan(3);
});
