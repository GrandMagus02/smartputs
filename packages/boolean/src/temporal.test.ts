import { expect, test } from "bun:test";
import { composeLocale, createEngine, type Engine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { date } from "@smartput/date";
import { datetime, TEST_NOW, TEST_ZONE } from "@smartput/datetime";
import { definePlace } from "@smartput/geo";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { time } from "@smartput/time";
import { truthOf } from "./index";

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

/**
 * Ruling C5, from both sides.
 *
 * `datetime`, `date` and `time` opt in, because their canonical is an instant
 * and ordering is the whole reason the scalar exists. `place` does not, and
 * that is the half worth testing: its canonical is a GeoNames feature id, so a
 * generated `>` would compare database row numbers and answer with total
 * confidence about nothing.
 */
const engine: Engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS, datetime, date, time, place],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

const truth = (input: string): boolean | null => truthOf(engine.evaluate(input).value);

test("instants order", () => {
  expect(truth("tomorrow > today")).toBe(true);
  expect(truth("yesterday > today")).toBe(false);
  expect(truth("today = today")).toBe(true);
  expect(truth("tomorrow != today")).toBe(true);
});

test("clock times order", () => {
  expect(truth("15:00 > 09:00")).toBe(true);
  expect(truth("09:00 >= 09:00")).toBe(true);
});

test("a place does not order, because its canonical is an identifier", () => {
  expect(() => engine.evaluate("ukraine > poland")).toThrow();
  // The kind still works for everything it did before; only the six
  // comparison signatures are absent.
  expect(engine.evaluate("ukraine").kind).toBe("place");
});
