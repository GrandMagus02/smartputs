import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english as coreEn } from "@smartput/locale-en";
import { OFFSET_ZONES, ZONES } from "@smartput/timezone";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import datetimeEn from "./en";

const engine = createEngine({
  locales: [composeLocale(coreEn, [...BUILTIN_EN, datetimeEn])],
  kinds: [...BUILTIN_KINDS, datetime],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

/** The unit ids the kind declares, in R1's shape: bare strings. */
const declared = Array.isArray(datetime.value.units) ? [...datetime.value.units] : [];

test("it targets English and names its kind by id", () => {
  expect(datetimeEn.locale).toBe("en");
  expect(datetimeEn.kind).toBe("datetime");
});

test("covers every unit the kind declares", () => {
  expect(Object.keys(datetimeEn.units).sort()).toEqual(declared.sort());
});

test("every unit has a symbol, and every named zone has aliases (R8)", () => {
  for (const [unit, words] of Object.entries(datetimeEn.units)) {
    expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    // An offset zone ships none on purpose: "gmt+3" lexes as three tokens, so
    // no alias lookup could ever reach it — `parseOffsetZone` is its only door.
    if (unit in OFFSET_ZONES) continue;
    expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
  }
});

test("the kind itself carries no English word", () => {
  const source = JSON.stringify(datetime);
  expect(source).not.toMatch(/universal|manhattan|brooklyn|hollywood|england|britain/i);
  expect(source).not.toMatch(/ukraine|japan|nyc|jst/i);
});

test("the words the zone table ships come through", () => {
  expect(datetimeEn.units.UTC?.aliases).toContain("utc");
  expect(datetimeEn.units["Asia/Tokyo"]?.symbol).toBe(ZONES["Asia/Tokyo"]?.symbol);
});

test("the spelled-out zone words come through beside them", () => {
  expect(datetimeEn.units["Asia/Tokyo"]?.aliases).toContain("japan");
  expect(datetimeEn.units["Europe/Kyiv"]?.aliases).toContain("ukraine");
  // Merged, not duplicated: `japan` is both a zone alias and a spelled-out one.
  const tokyo = datetimeEn.units["Asia/Tokyo"]?.aliases ?? [];
  expect(tokyo.length).toBe(new Set(tokyo).size);
});

test("an engine built from it reads English zone words", () => {
  expect(engine.evaluate("3pm in japan").formatted).toBe("2026-01-16 00:00 JST");
  expect(engine.evaluate("3pm in tokyo").formatted).toBe("2026-01-16 00:00 JST");
  expect(engine.evaluate("3pm in utc").formatted).toBe("2026-01-15 15:00 UTC");
});
