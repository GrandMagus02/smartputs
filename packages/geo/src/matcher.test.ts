import { expect, test } from "bun:test";
import type { MatchCtx } from "@smartput/core";
import { COUNTRIES } from "./data/countries";
import { createPlaceLiteral } from "./matcher";
import type { CountryRow } from "./types";

const placeLiteral = createPlaceLiteral(COUNTRIES);

function ctx(isUnitAlias: (t: string) => boolean = () => false): MatchCtx {
  return { locale: "en", now: 0, timeZone: "UTC", isUnitAlias };
}

/** `input` with the claim's offset marked by a `|`, which the helper strips. */
function claim(marked: string, isUnitAlias?: (t: string) => boolean) {
  const bar = marked.indexOf("|");
  const input = bar === -1 ? marked : marked.replace("|", "");
  return placeLiteral(input, bar === -1 ? 0 : bar, ctx(isUnitAlias));
}

const row = (a2: string) => COUNTRIES.find((c) => c.a2 === a2) as CountryRow;

test("claims a single-word country name", () => {
  const jp = row("jp");
  const match = claim("japan");
  expect(match).toMatchObject({
    kind: "place",
    unit: "jp",
    length: 5,
    weight: 3,
    meta: {
      geonameId: jp.geonameId,
      zone: "Asia/Tokyo",
      currency: "JPY",
      lat: jp.lat,
      lon: jp.lon,
      population: jp.population,
      country: "jp",
    },
  });
  expect(match?.canonical.toNumber()).toBe(jp.geonameId);
});

test("matches case-insensitively — normalize() keeps the user's case", () => {
  expect(claim("Japan")?.unit).toBe("jp");
  expect(claim("JAPAN")?.unit).toBe("jp");
});

test("claims a multi-word name, which is the whole reason this is a matcher", () => {
  expect(claim("united kingdom")).toMatchObject({ unit: "gb", length: 14 });
  expect(claim("new zealand")).toMatchObject({ unit: "nz", length: 11 });
  expect(claim("united arab emirates")).toMatchObject({ unit: "ae", length: 20 });
});

test("longest match wins", () => {
  // "netherlands" is nl and a prefix of "netherlands antilles", which is an.
  expect(claim("netherlands")).toMatchObject({ unit: "nl", length: 11 });
  expect(claim("netherlands antilles")).toMatchObject({ unit: "an", length: 20 });
  expect(claim("bosnia")).toMatchObject({ unit: "ba", length: 6 });
  expect(claim("bosnia and herzegovina")).toMatchObject({ unit: "ba", length: 22 });
});

test("claims alpha-2 and alpha-3 codes, written as codes", () => {
  expect(claim("JP")).toMatchObject({ unit: "jp", length: 2 });
  expect(claim("JPN")).toMatchObject({ unit: "jp", length: 3 });
  expect(claim("Gbr")).toMatchObject({ unit: "gb", length: 3 });
});

test("a lowercase code is a word, not a country", () => {
  // "and" is Andorra and "ago" is Angola, and neither is any kind's unit, so
  // `isUnitAlias` cannot see them. The fold is destructive, so claiming one
  // would leave "two hundred and five g" and "3 days ago" with no reading.
  for (const word of ["jp", "and", "ago", "is", "it", "no"]) {
    expect(claim(word)).toBeNull();
  }
  expect(claim("AND")).toMatchObject({ unit: "ad" });
});

test("never claims part of a word", () => {
  // "new" is a node on the way to "new zealand"; "newark" is not a place.
  expect(claim("newark")).toBeNull();
  expect(claim("japanese")).toBeNull();
  expect(claim("chadwick")).toBeNull();
  expect(claim("japan's")).toBeNull();
});

test("a word the trie does not carry ends the walk", () => {
  // "the" is not a node, so a stray article stops it rather than being skipped.
  expect(claim("united the kingdom")).toBeNull();
  expect(claim("new york")).toBeNull();
});

test("the walk is bounded at four words", () => {
  const four = "federation of arab emirates";
  expect(claim(four)).toMatchObject({ unit: "ae", length: four.length });

  const alias = (...aliases: string[]): CountryRow => ({ ...row("jp"), aliases });
  const bounded = createPlaceLiteral([alias("alpha beta gamma delta")]);
  const unreachable = createPlaceLiteral([alias("alpha beta gamma delta epsilon")]);

  expect(bounded("alpha beta gamma delta", 0, ctx())).toMatchObject({ length: 22 });
  // The fifth word is never offered to the trie, so a five-word alias is dead
  // data and a four-word one still claims all four.
  expect(bounded("alpha beta gamma delta epsilon", 0, ctx())).toMatchObject({
    length: 22,
  });
  expect(unreachable("alpha beta gamma delta epsilon", 0, ctx())).toBeNull();
});

test("a single-word code yields to a registered unit alias", () => {
  // "km" is Comoros' alpha-2 and a kilometre. The unit wins whichever way it is
  // written, and the fold is destructive, so yielding is the only way "10 KM"
  // survives as a length.
  expect(claim("KM")).toMatchObject({ unit: "km" });
  expect(claim("KM", (t) => t === "km")).toBeNull();
  expect(claim("GB", (t) => t === "gb")).toBeNull();
  // The exemption is for names, which are never two letters and never collide.
  expect(claim("japan", (t) => t === "japan")).toMatchObject({ unit: "jp" });
  expect(claim("united kingdom", () => true)).toMatchObject({ unit: "gb" });
});

test("a single-word code never eats a conversion keyword", () => {
  // "in" is India, "to" is Tonga, "as" is American Samoa, "by" is Belarus.
  for (const word of ["in", "to", "as", "by"]) expect(claim(word)).toBeNull();
  expect(claim("japan |to france")).toBeNull();
  expect(claim("india")).toMatchObject({ unit: "in" });
});

test("prefers the larger country when one name is two countries", () => {
  // "congo" is both Congos, "soudan" is both Mali and Sudan. §6.1 ranks by
  // population everywhere else, so it ranks here; suggest() gets the rest.
  expect(claim("congo")).toMatchObject({ unit: "cd" });
  expect(claim("soudan")).toMatchObject({ unit: "sd" });
});

test("returns null for anything it does not carry", () => {
  expect(claim("qwertz")).toBeNull();
  expect(claim("100")).toBeNull();
  expect(claim("")).toBeNull();
  expect(claim("5 + 3")).toBeNull();
  expect(placeLiteral("japan", 5, ctx())).toBeNull();
});

test("claims from an offset in the middle of the input", () => {
  expect(claim("3pm in |japan")).toMatchObject({ unit: "jp", length: 5 });
  expect(claim("100 usd in |united kingdom")).toMatchObject({ unit: "gb", length: 14 });
});

test("length always lands on a word boundary", () => {
  const inputs = [
    "japan",
    "japan + france",
    "japan - france",
    "united kingdom to japan",
    "new zealand and japan",
    "JP",
    "bosnia and herzegovina now",
    "guinea-bissau to japan",
  ];
  for (const input of inputs) {
    const match = placeLiteral(input, 0, ctx());
    expect(match).not.toBeNull();
    const length = match?.length ?? 0;
    expect(length).toBeGreaterThan(0);
    const rest = input.slice(length);
    expect(rest === "" || /^[^\p{L}\p{N}]/u.test(rest)).toBe(true);
  }
});

test("every alias the trie carries claims itself whole, for a registered unit", () => {
  const units = new Set(COUNTRIES.map((c) => c.a2));
  for (const country of COUNTRIES) {
    for (const alias of country.aliases) {
      const match = placeLiteral(alias, 0, ctx());
      // A code the keyword guard refuses is the one alias with no reading.
      if (match === null) continue;
      expect(units.has(match.unit)).toBe(true);
      expect(match.meta?.country).toBe(match.unit);
      expect(match.length).toBe(alias.length);
    }
  }
});
