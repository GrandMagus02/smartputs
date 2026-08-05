import { expect, test } from "bun:test";
import {
  buildAliases,
  parseAlternateNames,
  parseCities,
  parseCountryInfo,
  parseTimeZones,
  resolveCapital,
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

const countries = parseCountryInfo(countryInfoText);
const cities = parseCities(citiesText);
const byA2 = new Map(countries.map((c) => [c.a2, c]));

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
