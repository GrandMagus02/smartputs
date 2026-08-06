import { expect, test } from "bun:test";
import { snapshot } from "./snapshot";

// One euro buys 1.1 dollars and 45.5 hryvnia.
const rates = snapshot("EUR", "2026-08-04", { USD: 1.1, UAH: 45.5 });

test("the base converts to itself at one", () => {
  expect(rates.get("EUR", "EUR")?.toString()).toBe("1");
  expect(rates.get("USD", "USD")?.toString()).toBe("1");
});

test("a quote against the base reads straight off the table", () => {
  expect(rates.get("EUR", "USD")?.toString()).toBe("1.1");
});

test("the inverse direction divides", () => {
  expect(rates.get("USD", "EUR")?.toString()).toBe("0.9090909090909090909090909091");
});

test("a cross rate goes through the base", () => {
  // 45.5 UAH per EUR / 1.1 USD per EUR = 41.36... UAH per USD.
  expect(rates.get("USD", "UAH")?.toString()).toBe("41.36363636363636363636363636");
});

test("an unknown currency is null, not an exception", () => {
  expect(rates.get("USD", "JPY")).toBeNull();
  expect(rates.get("JPY", "USD")).toBeNull();
});

test("codes are matched case-insensitively", () => {
  expect(rates.get("usd", "eur")?.toString()).toBe("0.9090909090909090909090909091");
});

test("the snapshot is frozen and carries its date", () => {
  expect(rates.base).toBe("EUR");
  expect(rates.asOf).toBe("2026-08-04");
  expect(Object.isFrozen(rates)).toBe(true);
});
