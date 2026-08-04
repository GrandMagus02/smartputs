import { expect, test } from "bun:test";
import { createEngine, number } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { money } from "../money";
import { snapshot } from "../snapshot";
import enMoney from "./en";

const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, GBP: 0.8412 });
const engine = createEngine({
  locales: [en],
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
