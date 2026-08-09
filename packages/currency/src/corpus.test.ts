import { expect, test } from "bun:test";
import { Decimal } from "@smartput/core";
import { Corpora } from "@smartput/core/testing";
import { type FormatAmountOptions, formatAmount } from "./format";
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
 *
 * The two languages divide along a second line, and it is the one this package
 * documents about itself: what a currency *is* does not vary by language, and
 * how its digits are written does. So `uk.tsv` reads the same codes and refuses
 * the same strings — `parseAmount` is Latin by design, and the Cyrillic rows at
 * the bottom of that file are what proves it — while every amount it writes
 * comes back through a Ukrainian `formatNumber`, decimal comma and all. That
 * hook is not a test fixture: `plainDigits` is the default only because a
 * caller with no engine has to get something readable, and the engine passes
 * its own formatter exactly the way the `uk` row below does.
 */
const UK: FormatAmountOptions = {
  formatNumber: (amount, opts) =>
    // A `Decimal` carries no trailing zero, so the scale is restored here
    // rather than left to Intl's defaults: `minimumFractionDigits` is what
    // keeps `$30.00` from coming back as `$30`, and it is the same fact that
    // makes `formatAmount` pass the scale down at all.
    new Intl.NumberFormat("uk", {
      useGrouping: false,
      minimumFractionDigits: opts.minFractionDigits,
      maximumFractionDigits: opts.minFractionDigits,
    }).format(Number(amount.toFixed(opts.minFractionDigits))),
};

const corpora = await Corpora.load(new URL("../corpus/", import.meta.url), [
  { id: "en" },
  { id: "uk" },
]);

/** Both readings appear below, so the mode is part of the row's identity. */
corpora.each(([input, mode, outcome, currency, amount, formatted], language) => {
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
  expect(
    formatAmount(
      new Decimal(parsed.raw),
      parsed.currency,
      language.id === "uk" ? UK : {},
    ),
  ).toBe(formatted as string);
});

/**
 * The refusals are not decoration. A corpus of successes would pass just as
 * happily against a parser that accepted everything, so the count is asserted
 * rather than left to whoever edits the table next — in both languages, since
 * the Ukrainian half is mostly *about* what this parser will not read.
 */
for (const id of ["en", "uk"]) {
  test(`${id}: the corpus records refusals as well as answers`, () => {
    expect(corpora.rows(id).filter((r) => r[2] !== "ok").length).toBeGreaterThan(4);
  });
}
