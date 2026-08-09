import { expect, test } from "bun:test";
import { Decimal } from "@smartput/core";
import { formatAmount } from "./format";
import { type AmountError, parseAmount } from "./parse";

/**
 * The corpus for `@smartput/currency`: one row per string somebody might type
 * into a form field, read by `parseAmount` and written back by `formatAmount`.
 *
 * The two functions are asserted together rather than in separate files because
 * the round trip is the contract a consumer actually depends on — a parser that
 * reads "1,250.50 dollars" correctly and a formatter that writes it back as
 * `$1250.5` have each passed their own test and failed the only one that
 * matters. `Decimal` comes from `p.raw` and not from `p.amount`: the raw digits
 * are what survive a currency with more minor units than a float has room for.
 *
 * No rate anywhere. Every answer below is a fact about the currency — its
 * symbol, its minor units, its words — and none of them changes when a rate
 * does, which is the line this package is split along.
 */
const raw = await Bun.file(new URL("../corpus/en.tsv", import.meta.url)).text();

const rows = raw
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith("#"))
  .map((line) => line.split("\t"));

test("the corpus has rows", () => {
  expect(rows.length).toBeGreaterThan(10);
});

/** Both readings appear below, so the mode is part of the row's identity. */
for (const [input, mode, outcome, currency, amount, formatted] of rows) {
  test(`corpus: ${input} (${mode})`, () => {
    const parsed = parseAmount(input as string, { symbols: mode === "symbols" });

    if (outcome !== "ok") {
      expect(parsed.ok).toBe(false);
      if (parsed.ok) return;
      expect(parsed.code).toBe(outcome as AmountError);
      return;
    }

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.currency).toBe(currency as string);
    expect(parsed.amount).toBe(Number(amount));
    expect(formatAmount(new Decimal(parsed.raw), parsed.currency)).toBe(
      formatted as string,
    );
  });
}

/**
 * The refusals are not decoration. A corpus of successes would pass just as
 * happily against a parser that accepted everything, so the count is asserted
 * rather than left to whoever edits the table next.
 */
test("the corpus records refusals as well as answers", () => {
  expect(rows.filter((r) => r[2] !== "ok").length).toBeGreaterThan(4);
});
