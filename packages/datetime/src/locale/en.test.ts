import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english as coreEn } from "@smartput/locale-en";
import { datetime } from "../datetime";
import { TEST_NOW, TEST_ZONE } from "../temporal";
import en from "./en";

const engine = createEngine({
  locales: [composeLocale(coreEn, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS, datetime],
  packs: [en],
  now: () => TEST_NOW,
  timeZone: TEST_ZONE,
});

test("the pack targets English", () => {
  expect(en.locale).toBe("en");
});

test("the pack adds spelled-out zone words", () => {
  expect(engine.evaluate("3pm in japan").formatted).toBe("2026-01-16 00:00 JST");
});

test("every unit the pack contributes exists on the kind", () => {
  const units = Object.keys(en.contributes.datetime ?? {});
  expect(units.length).toBeGreaterThan(0);
  const declared = new Set(Object.keys((datetime.value as { units: object }).units));
  for (const unit of units) expect(declared.has(unit)).toBe(true);
});
