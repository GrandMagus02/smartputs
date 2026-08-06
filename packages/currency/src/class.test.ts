import { expect, test } from "bun:test";
import { Decimal } from "@smartput/core";
import { Currency } from "./class";
import { CURRENCIES } from "./currencies";

test("a currency is reachable by code and by any word that names one", () => {
  const usd = Currency.for("usd");
  expect(usd?.code).toBe("usd");
  expect(Currency.for("USD")).toBe(usd);
  expect(Currency.for("dollars")).toBe(usd);
});

test("one instance per code, so identity means what it looks like", () => {
  expect(Currency.for("eur")).toBe(Currency.for("euro"));
});

test("a word naming no currency is null rather than an empty currency", () => {
  expect(Currency.for("xyz")).toBeNull();
  expect(Currency.for("")).toBeNull();
});

test("the instance is frozen", () => {
  const usd = Currency.for("usd") as Currency;
  expect(Object.isFrozen(usd)).toBe(true);
});

test("all() is the shipped table and nothing more", () => {
  const codes = Currency.all().map((c) => c.code);
  expect(codes).toEqual(Object.keys(CURRENCIES));
});

test("format and parse are the free functions with the code already held", () => {
  const jpy = Currency.for("yen") as Currency;
  expect(jpy.format(new Decimal("1200"))).toBe("¥1200");

  const parsed = jpy.parse("1200 jpy");
  expect(parsed.ok).toBe(true);
  if (parsed.ok) expect(parsed.amount).toBe(1200);
});

/**
 * A `Currency` is a currency, so parsing a different one through it is a
 * mistake worth reporting rather than a value worth returning: a form field
 * bound to JPY that quietly accepted "30 usd" would be the bug.
 */
test("parsing another currency through this one is refused", () => {
  const jpy = Currency.for("jpy") as Currency;
  const parsed = jpy.parse("30 usd");
  expect(parsed.ok).toBe(false);
  if (!parsed.ok) expect(parsed.code).toBe("unknown-currency");
});
