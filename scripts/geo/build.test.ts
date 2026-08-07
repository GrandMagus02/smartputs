import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "../../packages/kinds/src/index";
import BUILTIN_EN from "../../packages/kinds/src/locale/en";
import { english as en } from "../../packages/locale-en/src/english";
import { NUMBER_WORDS } from "../../packages/number/src/words";
import {
  buildAdmin1Aliases,
  buildAliases,
  buildCityAliases,
  buildReserved,
  type City,
  calendarWords,
  chronoWords,
  isTier1,
  keywordWords,
  parseAdmin1,
  parseAlternateNames,
  parseCities,
  parseCountryInfo,
  parseTimeZones,
  reservedSet,
  resolveCapital,
  shortPlaceCodes,
  unitWords,
} from "./build";

/**
 * The whole point of this file is that it never reaches the network. The
 * generator's job is to survive a GeoNames layout change, and a test that
 * re-downloads proves nothing about the columns the last release had — it just
 * fails on whatever is upstream today, in CI, for reasons nobody can review.
 * Checked-in samples make a column shift a diff in this directory.
 */
const dir = new URL("./fixtures/", import.meta.url);
const countryInfoText = await Bun.file(new URL("countryInfo.sample.txt", dir)).text();
const citiesText = await Bun.file(new URL("cities15000.sample.txt", dir)).text();
const admin1Text = await Bun.file(new URL("admin1.sample.txt", dir)).text();

const countries = parseCountryInfo(countryInfoText);
const cities = parseCities(citiesText);
const divisions = parseAdmin1(admin1Text);
const byA2 = new Map(countries.map((c) => [c.a2, c]));
const byKey = new Map(divisions.map((d) => [d.key, d]));

/** Throws rather than asserting non-null, so a missing sample row names itself. */
const sample = (a2: string) => {
  const row = byA2.get(a2);
  if (row === undefined) throw new Error(`${a2} is missing from the countryInfo sample`);
  return row;
};

test("the '#' preamble is skipped and every sample row survives", () => {
  expect(countries.map((c) => c.a2)).toEqual(["aq", "gb", "jp", "pw", "ua", "us"]);
});

test("countryInfo columns land where the header says they do", () => {
  expect(byA2.get("jp")).toEqual({
    a2: "jp",
    a3: "jpn",
    name: "Japan",
    capital: "Tokyo",
    area: 377835,
    population: 126529100,
    currency: "JPY",
    phone: "81",
    postalRegex: "^\\d{3}-\\d{4}$",
    geonameId: 1861060,
  });
});

test("the United Kingdom's multi-format postal column does not shift the columns", () => {
  // Column 13 holds seven postal formats separated by '|', which is exactly the
  // shape that would break a naive split — and the columns after it are the
  // ones the table actually needs.
  const gb = byA2.get("gb");
  expect(gb?.currency).toBe("GBP");
  expect(gb?.phone).toBe("44");
  expect(gb?.geonameId).toBe(2635167);
  expect(gb?.postalRegex.startsWith("^([Gg][Ii][Rr]")).toBe(true);
});

test("a country with blank columns parses to empty strings, not undefined", () => {
  // Antarctica has no capital, no currency and no calling code. Emitting it is
  // deliberate: dropping a row because a column is blank is how a table quietly
  // loses members between releases.
  expect(byA2.get("aq")).toMatchObject({
    a2: "aq",
    name: "Antarctica",
    capital: "",
    currency: "",
    phone: "",
    postalRegex: "",
    geonameId: 6697173,
  });
});

test("cities columns land where the header says they do", () => {
  const tokyo = cities.find((c) => c.geonameId === 1850147);
  expect(tokyo).toMatchObject({
    name: "Tokyo",
    asciiName: "Tokyo",
    lat: 35.6895,
    lon: 139.69171,
    featureCode: "PPLC",
    country: "JP",
    population: 9733276,
    zone: "Asia/Tokyo",
  });
  expect(tokyo?.alternateNames).toContain("Tokio");
});

test("the capital is matched by name and carries its own zone and coordinates", () => {
  expect(resolveCapital(sample("jp"), cities)).toEqual({
    name: "Tokyo",
    lat: 35.6895,
    lon: 139.69171,
    zone: "Asia/Tokyo",
    fallback: null,
  });
});

test("PPLC beats population, so Washington wins over New York City", () => {
  expect(resolveCapital(sample("us"), cities)?.name).toBe("Washington");
  expect(resolveCapital(sample("us"), cities)?.zone).toBe("America/New_York");
});

test("a capital named differently upstream falls back and says so", () => {
  // countryInfo still calls Palau's capital Melekeok; the seat moved to
  // Ngerulmud in 2006 and cities15000 marks Ngerulmud PPLC. The fallback is
  // reported rather than swallowed so the generator's log stays reviewable.
  expect(sample("pw").capital).toBe("Melekeok");
  expect(resolveCapital(sample("pw"), cities)).toEqual({
    name: "Ngerulmud",
    lat: 7.50077,
    lon: 134.6238,
    zone: "Pacific/Palau",
    fallback: 'no city matched "Melekeok"',
  });
});

test("a country with no city rows at all resolves to nothing", () => {
  expect(resolveCapital(sample("aq"), cities)).toBeNull();
});

test("timeZones.txt yields one zone per country code", () => {
  const zones = parseTimeZones(
    [
      "CountryCode\tTimeZoneId\tGMT offset 1. Jan 2026\tDST offset 1. Jul 2026\trawOffset",
      "AQ\tAntarctica/Casey\t11.0\t11.0\t11.0",
      "AQ\tAntarctica/Davis\t7.0\t7.0\t7.0",
      "UM\tPacific/Midway\t-11.0\t-11.0\t-11.0",
    ].join("\n"),
  );
  // First wins: the file is sorted by zone and a country with ten Antarctic
  // stations has no "right" one, so picking deterministically beats picking well.
  expect(zones.get("AQ")).toBe("Antarctica/Casey");
  expect(zones.get("UM")).toBe("Pacific/Midway");
  expect(zones.has("CountryCode")).toBe(false);
});

test("alternate names are kept only for the ids asked for, and only usable ones", () => {
  const kept = parseAlternateNames(
    [
      "1\t1861060\ten\tJapan\t1\t\t\t\t\t",
      "2\t1861060\t\tNippon\t\t\t1\t\t\t",
      "3\t1861060\tabbr\tJPN\t\t\t\t\t\t",
      "4\t1861060\tja\t日本\t1\t\t\t\t\t",
      "5\t1861060\tit\tGiappone\t\t\t\t\t\t",
      "6\t1861060\tlink\thttps://en.wikipedia.org/wiki/Japan\t\t\t\t\t\t",
      "7\t1861060\twkdt\tQ17\t\t\t\t\t\t",
      "8\t690791\ten\tUkraine\t1\t\t\t\t\t",
    ].join("\n"),
    new Set([1861060]),
  );
  // `link` and `wkdt` are URLs and Wikidata ids wearing a name column. A named
  // language other than English is refused even when it is ASCII: exonyms are a
  // locale's problem, and keeping them quadruples the table.
  expect(kept.get(1861060)).toEqual(["Japan", "Nippon", "JPN"]);
  expect(kept.has(690791)).toBe(false);
});

test("aliases carry the name, both codes and the usable variants", () => {
  expect(buildAliases("Japan", "jp", "jpn", ["Nippon", "Nihon", "Japan"])).toEqual([
    "japan",
    "jpn",
    "jp",
    "nihon",
    "nippon",
  ]);
});

test("aliases refuse the shapes that would collide with units or numbers", () => {
  const aliases = buildAliases("United States", "us", "usa", [
    "U.S.", // a dot is not a word a launcher tokenizes
    "US", // the alpha-2 is allowed, and it is already present
    "UK", // two letters, and not this country's alpha-2
    "840", // pure digits would read as a number
    "América", // non-ASCII is unreachable from the keyboard
    "United States of America Incorporated Union", // past the trie's four-word bound
    "The United States of America", // five words, same bound
    "United States of America",
  ]);
  expect(aliases).toEqual(["united states", "usa", "us", "united states of america"]);
});

// ---------------------------------------------------------------------------
// M6.2: cities, divisions and the reserved set
// ---------------------------------------------------------------------------

test("the cities sample still carries its admin1 column", () => {
  // Column 10, two to the right of the country code and four to the left of
  // population — the two columns the T0 table already depended on, so a shift
  // that moved admin1 without moving them would otherwise pass unnoticed.
  const at = (id: number) => cities.find((c) => c.geonameId === id)?.admin1;
  expect(at(1850147)).toBe("40"); // Tokyo: a numbered prefecture
  expect(at(2643743)).toBe("ENG"); // London: a lettered code
  expect(at(4140963)).toBe("DC");
  expect(at(8063361)).toBe("07");
});

test("admin1CodesASCII columns land where the file says they do", () => {
  expect(byKey.get("US.TX")).toEqual({
    key: "US.TX",
    name: "Texas",
    asciiName: "Texas",
    geonameId: 4736286,
  });
});

test("a division keeps its accented name beside the ASCII one", () => {
  // Column 1 is UTF-8 and column 2 is its transliteration; conflating them would
  // put "Île-de-France" into an alias index a keyboard cannot reach.
  expect(byKey.get("FR.11")).toMatchObject({
    name: "Île-de-France",
    asciiName: "Ile-de-France",
  });
});

test("a line whose key is not COUNTRY.CODE is refused rather than half-parsed", () => {
  // `CityRow.admin1` promises a join, so a key that cannot be one is not a row.
  const junk = ["", "notakey\tSomewhere\tSomewhere\t1", "x.y\tA\tA\t2"].join("\n");
  expect(parseAdmin1(junk)).toEqual([]);
});

const city = (over: Partial<City>): City => ({
  geonameId: 1,
  name: "Somewhere",
  asciiName: "Somewhere",
  alternateNames: [],
  lat: 0,
  lon: 0,
  featureCode: "PPL",
  country: "US",
  admin1: "",
  population: 0,
  zone: "UTC",
  ...over,
});

test("the tier is population, and a seat of government whatever its size", () => {
  expect(isTier1(city({ population: 100_000 }))).toBe(true);
  expect(isTier1(city({ population: 99_999 }))).toBe(false);
  // Ngerulmud has no population on this table at all and is still what "palau"
  // has to resolve through, which is the whole reason for the second clause.
  expect(isTier1(city({ population: 0, featureCode: "PPLC" }))).toBe(true);
});

const NOTHING_RESERVED = new Set<string>();

test("city aliases take the name, the ASCII name and the English variants", () => {
  expect(
    buildCityAliases("Kyiv", "Kyiv", ["Kiev", "Kyiv"], NOTHING_RESERVED).aliases,
  ).toEqual(["kyiv", "kiev"]);
});

test("a city alias is held to four characters, where a country's is held to three", () => {
  // A country may be two letters because its alpha-2 is a code, and codes are
  // exempt. A city has no code, so every alias it has is a name — and a
  // three-letter name is a token some other kind may own. Ufa is the price.
  expect(buildCityAliases("Ufa", "Ufa", [], NOTHING_RESERVED).aliases).toEqual([]);
  expect(buildCityAliases("Lyon", "Lyon", [], NOTHING_RESERVED).aliases).toEqual([
    "lyon",
  ]);
});

test("city aliases refuse the shapes the trie cannot walk", () => {
  const { aliases } = buildCityAliases(
    "São José do Rio Preto",
    "Sao Jose do Rio Preto", // five words, past the trie's bound
    [
      "St. Catharines", // a dot the launcher tokenizes on
      "Rio Preto",
      "Rio Preto", // the duplicate is dropped, not emitted twice
      "リオプレト", // non-ASCII is unreachable from the keyboard
    ],
    NOTHING_RESERVED,
  );
  expect(aliases).toEqual(["rio preto"]);
});

test("a reserved word is refused as a whole-alias name and reported", () => {
  const reserved = new Set(["march", "reading"]);
  const one = buildCityAliases("March", "March", [], reserved);
  expect(one.aliases).toEqual([]);
  expect(one.reserved).toEqual(["march"]);

  // Two words in a row are nobody's unit and nobody's keyword — the same line
  // the matcher draws by only testing `claimable` on a one-word claim — so a
  // reserved word inside a longer name costs nothing.
  const two = buildCityAliases("March Hare", "March Hare", [], reserved);
  expect(two.aliases).toEqual(["march hare"]);
  expect(two.reserved).toEqual([]);
});

test("a division is named and, when its code is letters, coded", () => {
  expect(buildAdmin1Aliases("US.TX", "Texas", "Texas", NOTHING_RESERVED)).toEqual([
    "texas",
    "tx",
  ]);
  // Japan's prefectures are numbered, and "40" is a number before it is Tokyo.
  expect(buildAdmin1Aliases("JP.40", "Tokyo", "Tokyo", NOTHING_RESERVED)).toEqual([
    "tokyo",
  ]);
  expect(
    buildAdmin1Aliases("FR.11", "Île-de-France", "Ile-de-France", NOTHING_RESERVED),
  ).toEqual(["ile-de-france"]);
});

test("a division's code yields to a reserved word, and only the code is lost", () => {
  // Without this, "paris in ukraine" claims "paris in" as a city in Indiana and
  // the conversion keyword is gone — and the fold is destructive, so there is no
  // second reading underneath.
  const reserved = new Set(["in", "or"]);
  expect(buildAdmin1Aliases("US.IN", "Indiana", "Indiana", reserved)).toEqual([
    "indiana",
  ]);
  expect(buildAdmin1Aliases("US.OR", "Oregon", "Oregon", reserved)).toEqual(["oregon"]);
});

test("each reserved source produces the words it is the authority for", () => {
  // One assertion per source, so a source that silently stops producing anything
  // names itself here rather than as a missing word in reserved.ts.
  expect(keywordWords(en)).toEqual(
    expect.arrayContaining(["in", "to", "as", "of", "by", "times", "over"]),
  );
  // NUMBER_WORDS goes into the set unchanged, so the source that could fail is
  // the package itself losing a word — "hundred" was missing from it once.
  expect(NUMBER_WORDS).toEqual(
    expect.arrayContaining(["one", "hundred", "million", "and"]),
  );
  expect(calendarWords()).toEqual(
    expect.arrayContaining(["March", "May", "Monday", "Mar", "Mon"]),
  );
  expect(chronoWords()).toEqual(
    expect.arrayContaining(["today", "tomorrow", "yesterday", "ago", "next", "last"]),
  );
  // The words half arrives as vocabularies now, not off the kind: "km" is a
  // unit id either way, but "mile" only exists in `@smartput/length/locale/en`.
  expect(unitWords(BUILTIN_KINDS, BUILTIN_EN)).toEqual(
    expect.arrayContaining(["km", "mile", "kg", "kilometres"]),
  );
  expect(shortPlaceCodes([{ aliases: ["no", "nor", "norway"] }])).toEqual(["no", "nor"]);
});

test("the reserved set is sorted, deduplicated, and words only", () => {
  const reserved = buildReserved(
    [
      { id: "first", words: ["Times", "times", "°C", "3pm", "over"] },
      { id: "second", words: ["ago", "over"] },
    ],
    [],
  );
  // "°C" and "3pm" are not words a city can be called, so they are not words a
  // city has to be refused; carrying them would only make the set harder to read.
  expect(reserved.derived).toEqual(["ago", "over", "times"]);
  // Counted before overlap, because what the header has to tell a reader is that
  // a source is still speaking — not how much of it was new.
  expect(reserved.contributions).toEqual([
    ["first", 3],
    ["second", 2],
  ]);
});

test("a supplement word a source already produces is pruned and reported", () => {
  // The supplement exists for words no derivation reaches. One that a source
  // does reach is a hand list growing back, so it is dropped rather than kept.
  const reserved = buildReserved(
    [{ id: "keywords", words: ["over"] }],
    [
      { word: "over", why: ["a source produces this"] },
      { word: "or", why: ["no source does"] },
    ],
  );
  expect(reserved.redundant).toEqual(["over"]);
  expect(reserved.supplement.map((e) => e.word)).toEqual(["or"]);
  expect([...reservedSet(reserved)].sort()).toEqual(["or", "over"]);
});
