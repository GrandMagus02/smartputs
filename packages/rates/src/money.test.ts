import { expect, test } from "bun:test";
import { createEngine, createFacades, MissingRateError, number } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { money } from "./money";
import { snapshot } from "./snapshot";

// One euro buys 1.1 dollars and 45.5 hryvnia.
const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 });
const engine = createEngine({ locales: [en], kinds: [number, money], rates });

test("a bare amount is money in its authored currency", () => {
  const r = engine.evaluate("30 usd");
  expect(r.kind).toBe("money");
  expect(r.value.canonical.toString()).toBe("27.27272727272727272727272727");
  expect(r.formatted).toBe("$30.00");
});

test("mixed-currency subtraction keeps the left operand's currency", () => {
  const r = engine.evaluate("30 usd - 10 eur");
  expect(r.value.canonical.toString()).toBe("17.27272727272727272727272727");
  expect(r.formatted).toBe("$19.00");
});

test("conversion goes through the canonical euro", () => {
  expect(engine.evaluate("100 usd in uah").formatted).toBe("₴4,136.36");
});

test("the result is dated from the snapshot", () => {
  expect(engine.evaluate("30 usd").meta.ratesAsOf).toBe("2026-08-04");
});

test("a cross rate is recorded, never silent", () => {
  const r = engine.evaluate("100 usd in uah");
  const cross = r.meta.assumptions.find((a) => a.code === "cross-rate");
  expect(cross).toBeDefined();
  expect(cross?.detail).toEqual({ from: "USD", to: "UAH", via: "EUR" });
});

test("a conversion involving the base records no cross-rate assumption", () => {
  expect(engine.evaluate("30 usd in eur").meta.assumptions).toEqual([]);
});

test("a currency absent from the snapshot raises MissingRateError", () => {
  expect(() => engine.evaluate("30 jpy")).toThrow(MissingRateError);
});

test("a zero-minor-unit currency formats without decimals", () => {
  const withYen = createEngine({
    locales: [en],
    kinds: [number, money],
    rates: snapshot("EUR", "2026-08-04", { JPY: 170 }),
  });
  expect(withYen.evaluate("5000 jpy").formatted).toBe("¥5,000");
});

test("money never rounds mid-expression", () => {
  // A third of a dollar three times is a dollar, not 0.99.
  const r = engine.evaluate("(1 usd / 3) * 3");
  expect(r.formatted).toBe("$1.00");
});

test("a money facade converts, using the same rates the engine does", () => {
  // RULING 1: createFacade/createFacades had no `rates` parameter at all, so a
  // money Quantity built by createFacades could not convert, compare, add, or
  // format — every operation either threw MissingRateError or silently
  // miscomputed. Threading `rates` through fixes that.
  const facades = createFacades({ kinds: [number, money], locale: en, rates });
  const Money = facades.money;
  if (Money === undefined) throw new Error("missing money facade");
  const converted = new Money(30, "usd").to("eur");
  const fromEngine = engine.evaluate("30 usd").value.canonical;
  expect(converted.toString()).toBe(fromEngine.toString());
});
