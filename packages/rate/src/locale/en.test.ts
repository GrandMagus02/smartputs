import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/locale-en";
import { number } from "@smartput/number";
// Through the package path, not "./en": the exports map is the only route a
// consumer has, and importing by relative path is exactly what hid the fact
// that `./locale/en` was missing from it.
import enMoney from "@smartput/rate/locale/en";
import { money } from "../money";
import { snapshot } from "../snapshot";

const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412 });
const engine = createEngine({
  locales: [composeLocale(en)],
  kinds: [number, money],
  packs: [enMoney],
  rates,
});

test("spelled-out currency names resolve", () => {
  expect(engine.evaluate("30 dollars").kind).toBe("money");
  expect(engine.evaluate("30 quid").formatted).toBe("£30.00");
});

test("the pack adds vocabulary without replacing the built-in aliases", () => {
  expect(engine.evaluate("30 usd").formatted).toBe("$30.00");
});
