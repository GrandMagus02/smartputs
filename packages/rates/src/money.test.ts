import { expect, test } from "bun:test";
import {
  createEngine,
  createFacades,
  Decimal,
  MissingRateError,
  number,
} from "@smartput/core";
import en from "@smartput/core/locale/en";
import { money } from "./money";
import { snapshot } from "./snapshot";

// One euro buys 1.1 dollars, 45.5 hryvnia and 0.8412 pounds.
const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5, GBP: 0.8412 });
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

test("mixed-currency subtraction records the cross rate too", () => {
  // The disclosure used to live only in the `in` override, so arithmetic —
  // which goes through the generated `-|money|money` — derived USD/GBP through
  // the euro in silence. Spec §8: never silent.
  const r = engine.evaluate("30 usd - 10 gbp");
  const cross = r.meta.assumptions.find((a) => a.code === "cross-rate");
  expect(cross?.detail).toEqual({ from: "USD", to: "GBP", via: "EUR" });
});

test("mixed-currency addition records the cross rate too", () => {
  const r = engine.evaluate("1 usd + 1 uah");
  const cross = r.meta.assumptions.find((a) => a.code === "cross-rate");
  expect(cross?.detail).toEqual({ from: "USD", to: "UAH", via: "EUR" });
});

test("arithmetic through the base currency records nothing", () => {
  expect(engine.evaluate("30 usd - 10 eur").meta.assumptions).toEqual([]);
  expect(engine.evaluate("5 usd + 5 usd").meta.assumptions).toEqual([]);
});

test("the arithmetic overrides keep the left operand's unit and meta", () => {
  // They replace generated signatures whose apply is deriveValue(l, ...), so
  // kind, unit and meta must all still come from `l`.
  const r = engine.evaluate("30 usd - 10 gbp");
  expect(r.value.unit).toBe("usd");
  expect(r.value.kind).toBe("money");
  expect(r.formatted).toBe("$16.92");
});

test("a half-cent amount rounds the same way in every currency", () => {
  // `ctx.authored` for a non-canonical currency has been through the rate
  // twice and carries ±1ulp at the 28th digit, which used to decide the
  // half-even tie-break: "$0.01" for usd, "€0.00" for the same nominal
  // amount in euro. Guarding at display precision restores the tie.
  expect(engine.evaluate("0.005 usd").formatted).toBe("$0.00");
  expect(engine.evaluate("0.005 eur").formatted).toBe("€0.00");
  expect(engine.evaluate("0.005 uah").formatted).toBe("₴0.00");
});

test("a genuine half-cent tie rounds to even, canonical currency or not", () => {
  // 1.5 cents -> 2 (even), 2.5 cents -> 2 (even). ROUND_HALF_EVEN, unchanged
  // by the guard: the guard only removes noise that was never in the value.
  expect(engine.evaluate("0.015 eur").formatted).toBe("€0.02");
  expect(engine.evaluate("0.015 usd").formatted).toBe("$0.02");
  expect(engine.evaluate("0.025 eur").formatted).toBe("€0.02");
  expect(engine.evaluate("0.025 usd").formatted).toBe("$0.02");
});

test("a negative amount puts the sign outside the symbol", () => {
  expect(engine.evaluate("-10 usd").formatted).toBe("-$10.00");
  expect(engine.evaluate("-10 eur").formatted).toBe("-€10.00");
  // Rounding a small negative down to zero must not produce "-$0.00".
  expect(engine.evaluate("-0.001 usd").formatted).toBe("$0.00");
});

test("a currency absent from the snapshot raises MissingRateError", () => {
  expect(() => engine.evaluate("30 jpy")).toThrow(MissingRateError);
});

test("suggest raises MissingRateError rather than answering with nothing", () => {
  // Spec §7's "suggest() never throws" is about parse problems. A missing rate
  // is a data problem, and suggest is the keystroke-rate API — returning []
  // shows the user "no results" where the truth is "no rate for JPY".
  expect(() => engine.suggest("30 jpy")).toThrow(MissingRateError);
  // Unchanged for input that genuinely has no interpretation.
  expect(engine.suggest("30 zork")).toEqual([]);
});

test("EngineOptions.rounding reaches money's format hook", () => {
  const up = createEngine({
    locales: [en],
    kinds: [number, money],
    rates,
    rounding: Decimal.ROUND_UP,
  });
  expect(engine.evaluate("0.001 usd").formatted).toBe("$0.00");
  expect(up.evaluate("0.001 usd").formatted).toBe("$0.01");
  expect(up.evaluate("0.001 eur").formatted).toBe("€0.01");
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

test("a money facade has no dpi surface", () => {
  // The facade used to decide "this kind is dpi-aware" by finding the first
  // unit with a function ratio — true of `measure`'s px, and of all eleven
  // non-euro currencies. `new Money(30,"usd").dpi` threw MissingRateError from
  // a getter on the public Quantity interface, and `withDpi()` wrote a `dpi`
  // into meta that nothing reads. `money` declares no `dpiUnit`, so it now
  // gets neither member.
  const facades = createFacades({ kinds: [number, money], locale: en, rates });
  const Money = facades.money;
  if (Money === undefined) throw new Error("missing money facade");
  const q = new Money(30, "usd");
  expect("withDpi" in q).toBe(false);
  expect("dpi" in q).toBe(false);
  expect(() => q.dpi).not.toThrow();
  expect(q.dpi).toBeUndefined();
});
