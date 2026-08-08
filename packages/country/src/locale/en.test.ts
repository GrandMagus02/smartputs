import { expect, test } from "bun:test";
import {
  buildRegistry,
  composeLocale,
  createEngine,
  type OpaqueSpec,
  wordsFor,
} from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { length } from "@smartput/length";
import lengthEn from "@smartput/length/locale/en";
import { number } from "@smartput/number";
import { COUNTRIES } from "../data/countries";
import { MIN_NAME_LENGTH } from "../matcher";
import { place } from "../place";
import placeEn from "./en";

const spec = place.value as OpaqueSpec;
const units = (spec.units ?? []) as readonly string[];

test("covers every unit the kind declares", () => {
  expect(Object.keys(placeEn.units).sort()).toEqual([...units].sort());
  // And the units are the alpha-2 codes, unchanged by the split.
  expect([...units].sort()).toEqual(COUNTRIES.map((r) => r.a2).sort());
});

test("every unit has a symbol, and it is the country's name (R8)", () => {
  for (const row of COUNTRIES) {
    expect(placeEn.units[row.a2]?.symbol, `${row.a2} has no symbol`).toBe(row.name);
  }
});

test("aliases are the row's own, filtered by the matcher's floor", () => {
  for (const row of COUNTRIES) {
    expect(placeEn.units[row.a2]?.aliases).toEqual(
      row.aliases.filter((a) => a.length >= MIN_NAME_LENGTH),
    );
  }
  // The one country the floor leaves wordless: every alias GeoNames carries for
  // it is a code, and its name is five words where the generator caps at four.
  // Kept as an assertion rather than a caveat so a table change that gives it a
  // name is visible here.
  const wordless = COUNTRIES.filter(
    (r) => r.aliases.filter((a) => a.length >= MIN_NAME_LENGTH).length === 0,
  ).map((r) => r.a2);
  expect(wordless).toEqual(["um"]);
});

test("the kind itself carries no English word", () => {
  expect(JSON.stringify(place)).not.toMatch(/japan|ukraine|germany|andorra/i);
});

test("the alias index is built from it, and never from the codes", () => {
  const registry = buildRegistry([place], [composeLocale(en, [placeEn])]);
  expect(registry.aliasIndex.get("japan")).toEqual([
    { kind: "place", unit: "jp", locale: "en" },
  ]);
  expect(wordsFor(registry, "en", "place", "jp")?.symbol).toBe("Japan");
  // The load-bearing half of `COUNTRY_UNITS`' old comment, now a property of
  // the vocabulary: a country is indexed by name and never by its alpha-2, or
  // "km" would be Comoros as well as a kilometre and "3pm" a country instead of
  // a time. R2's "index the unit key too" is exactly what a kind with a
  // vocabulary opts out of.
  for (const code of ["km", "ua", "in", "as", "no", "is", "it", "am", "at"]) {
    expect(registry.aliasIndex.get(code) ?? []).toEqual([]);
  }
});

test("an engine built from it reads and writes English places", () => {
  const engine = createEngine({
    locales: [composeLocale(en, [lengthEn, placeEn])],
    kinds: [number, length, place],
  });
  expect(engine.evaluate("japan").formatted).toBe("Japan — JPY, +81, Asia/Tokyo, 127M");
  expect(engine.evaluate("france to germany").formatted).toBe("878.399 kilometres");
});
