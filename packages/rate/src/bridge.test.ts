import { expect, test } from "bun:test";
import {
  composeLocale,
  createEngine,
  Decimal,
  DimensionMismatchError,
  MissingRateError,
  SmartputError,
  type Value,
} from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { definePlace, placeVocabulary } from "@smartput/geo";
import { number } from "@smartput/number";
import { money } from "./money";
import { snapshot } from "./snapshot";

/**
 * The countries this file's assertions name, and nothing else.
 *
 * `@smartput/geo` ships no gazetteer — `definePlace` takes its table as an
 * argument — so a bridge test brings the three rows it needs rather than
 * importing a table that no longer exists anywhere. That is the shape the geo
 * package is built around, and a bridge test is exactly the consumer it was
 * built for.
 */
const COUNTRIES = [
  {
    a2: "jp",
    a3: "jpn",
    name: "Japan",
    aliases: ["japan", "jpn", "jp"],
    capital: "Tokyo",
    currency: "JPY",
    phone: "81",
    population: 127_185_332,
    area: 377_835,
    lat: 35.68536,
    lon: 139.75309,
    zone: "Asia/Tokyo",
    geonameId: 1_861_060,
    postalRegex: "^\\d{3}-\\d{4}$",
  },
  {
    a2: "ua",
    a3: "ukr",
    name: "Ukraine",
    aliases: ["ukraine", "ukr", "ua"],
    capital: "Kyiv",
    currency: "UAH",
    phone: "380",
    population: 44_622_516,
    area: 603_700,
    lat: 50.45466,
    lon: 30.5238,
    zone: "Europe/Kyiv",
    geonameId: 690_791,
    postalRegex: "^\\d{5}$",
  },
  {
    a2: "us",
    a3: "usa",
    name: "United States",
    aliases: ["united states", "america", "usa", "us"],
    capital: "Washington",
    currency: "USD",
    phone: "1",
    population: 327_167_434,
    area: 9_629_091,
    lat: 38.89511,
    lon: -77.03637,
    zone: "America/New_York",
    geonameId: 6_252_001,
    postalRegex: "^\\d{5}(-\\d{4})?$",
  },
];

const place = definePlace({ countries: COUNTRIES });
const placeEn = placeVocabulary(COUNTRIES);

const CORPUS = (await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text())
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"));

// One euro buys 1.1 dollars, 170 yen and 45.5 hryvnia.
const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, JPY: 170, UAH: 45.5 });

// `placeEn` wherever `place` is registered: a kind no language has spoken for
// is indexed under its own unit keys, and `place`'s are the ISO alpha-2 codes —
// "in" is India, "is" Iceland, "no" Norway. None of them may become a word the
// global alias index answers for.
const withGeo = createEngine({
  locales: [composeLocale(en, [placeEn])],
  kinds: [number, money, place],
  rates,
});
// The half this file exists to prove: an engine that never heard of geo.
const withoutGeo = createEngine({
  locales: [composeLocale(en)],
  kinds: [number, money],
  rates,
});

test("a country names its currency as an `in` target", () => {
  const r = withGeo.evaluate("100 usd in japan");
  expect(r.kind).toBe("money");
  expect(r.value.unit).toBe("jpy");
  // 100 USD is 90.90… EUR is 15,454.54… JPY, and JPY has no minor units.
  expect(r.formatted).toBe("¥15,455");
});

test("the country conversion goes through the same rate the code does", () => {
  expect(withGeo.evaluate("100 usd in japan").value.canonical.toString()).toBe(
    withGeo.evaluate("100 usd in jpy").value.canonical.toString(),
  );
});

test("a country conversion discloses its cross rate", () => {
  const cross = withGeo
    .evaluate("100 usd in japan")
    .meta.assumptions.find((a) => a.code === "cross-rate");
  expect(cross?.detail).toEqual({ from: "USD", to: "JPY", via: "EUR" });
});

test("a country on the euro is an identity, and assumes nothing", () => {
  const r = withGeo.evaluate("100 eur in france");
  expect(r.value.unit).toBe("eur");
  expect(r.formatted).toBe("€100.00");
  expect(r.meta.assumptions).toEqual([]);
});

test("the money result carries no place meta", () => {
  // The place's meta describes a country — geonameId, zone, lat/lon. Copying
  // it onto the amount the way `in|money|money` copies the target currency's
  // would put a population on a sum of money.
  expect(withGeo.evaluate("100 usd in japan").value.meta).toBeUndefined();
});

test("a country whose currency the snapshot cannot quote raises MissingRateError", () => {
  // Vietnam's dong is outside ECB's daily file, so it is not a money unit and
  // never will have a rate behind it.
  expect(() => withGeo.evaluate("100 usd in vietnam")).toThrow(MissingRateError);
  // Named as the currency, not as the country: "no rate for VN" would send the
  // reader looking for a country code in a currency table.
  try {
    withGeo.evaluate("100 usd in vietnam");
  } catch (e) {
    expect((e as MissingRateError).from).toBe("VND");
    expect((e as MissingRateError).asOf).toBe("2026-08-04");
  }
});

test("a quotable currency missing from this snapshot raises MissingRateError", () => {
  const noYen = createEngine({
    locales: [composeLocale(en, [placeEn])],
    kinds: [number, money, place],
    rates: snapshot("EUR", "2026-08-04", { USD: 1.1 }),
  });
  expect(() => noYen.evaluate("100 usd in japan")).toThrow(MissingRateError);
});

test("a place carrying no currency says so, rather than converting by NaN", () => {
  // Reached directly: every place `@smartput/country` ships carries a currency, so
  // the only way to see this is a Value from a provider (M6.3) that does not.
  const sig = money.ops?.find((o) => o.op === "in" && o.right === "place");
  if (sig === undefined) throw new Error("missing money|place signature");
  const amount: Value = { kind: "money", canonical: new Decimal(1), unit: "usd" };
  const nowhere: Value = {
    kind: "place",
    canonical: new Decimal(0),
    unit: "aq",
    meta: { zone: "Antarctica/Rothera" },
  };
  const ctx = { self: amount, locale: "en", input: "1 usd in nowhere", rates };
  expect(() => sig.apply(amount, nowhere, ctx)).toThrow(SmartputError);
  expect(() => sig.apply(amount, nowhere, ctx)).toThrow(/carries no currency/);
  // Not DimensionMismatchError, which is what the evaluator raises when the
  // signature is absent entirely — the two must stay tellable apart.
  expect(() => sig.apply(amount, nowhere, ctx)).not.toThrow(DimensionMismatchError);
});

test("without geo the engine still builds and rates behave as before", () => {
  // Registry pass 4 keys the op table without checking that `left` and `right`
  // name registered kinds, so `in|money|place` is present and unreachable.
  expect(withoutGeo.evaluate("100 usd in uah").formatted).toBe("₴4,136.36");
  expect(withoutGeo.evaluate("100 usd in jpy").formatted).toBe("¥15,455");
  expect(withoutGeo.evaluate("30 usd").formatted).toBe("$30.00");
  expect(withoutGeo.evaluate("30 usd + 10 uah").value.unit).toBe("usd");
});

test("without geo a country name is not a unit", () => {
  expect(() => withoutGeo.evaluate("100 usd in japan")).toThrow();
});

test("the whole corpus reads the same with geo registered", () => {
  // A kind that adds aliases to the global index can only be shown harmless
  // input by input: "mxn" is Mexico's currency and "mex" its alpha-3, and the
  // rates corpus is where a collision between the two would show.
  const corpusRates = snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 });
  const engine = createEngine({
    locales: [composeLocale(en, [placeEn])],
    kinds: [number, money, place],
    rates: corpusRates,
  });
  for (const line of CORPUS) {
    const [input, , , formatted] = line.split("\t");
    expect(`${input} => ${engine.evaluate(input as string).formatted}`).toBe(
      `${input} => ${formatted}`,
    );
  }
});
