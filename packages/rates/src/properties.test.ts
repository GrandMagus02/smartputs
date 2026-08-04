import { expect, test } from "bun:test";
import {
  createEngine,
  createFacades,
  Decimal,
  number,
  UnitParseError,
} from "@smartput/core";
import en from "@smartput/core/locale/en";
import { CURRENCIES } from "./currencies";
import { money } from "./money";
import { snapshot } from "./snapshot";

/**
 * Core's properties.test.ts asserts every spec §10 property over
 * `BUILTIN_KINDS`, which does not — and cannot — contain `money`: it lives in
 * this package and its ratios are functions of an injected table. So the one
 * kind in the repo whose ratios are not constants was covered by none of them.
 * This file mirrors core's, over currencies.
 *
 * The milestone's fixed snapshot, one quote per currency the kind declares: no
 * network, no wall clock, and every unit below actually exercisable.
 */
const rates = snapshot("EUR", "2026-08-04", {
  USD: 1.1,
  GBP: 0.8412,
  JPY: 170,
  CHF: 0.94,
  PLN: 4.28,
  UAH: 45.5,
  CAD: 1.5,
  AUD: 1.68,
  SEK: 11.2,
  NOK: 11.7,
  CZK: 24.8,
});

const facades = createFacades({ kinds: [number, money], locale: en, rates });
const Money = facades.money;
if (Money === undefined) throw new Error("missing money facade");
const engine = createEngine({ locales: [en], kinds: [number, money], rates });

const UNITS = Object.keys(CURRENCIES);
const SAMPLES = [
  "0",
  "1",
  "0.5",
  "12.25",
  "1000",
  "999999",
  "0.000001",
  // Beyond a JS number's 17 significant digits, for the same reason core's list
  // carries them: a reintroduced Number() anywhere in the rate path would pass
  // every other sample.
  "1234567890123456789012345678",
  "0.1234567890123456789012345678",
  "1234567890123456789.0625",
];

/**
 * Every non-euro rate here is a division that does not terminate (1/1.1,
 * 1/45.5, ...), so a round trip loses a digit or two at the tail of a
 * 28-significant-digit Decimal. Same relative-tolerance reasoning core's
 * transitivity test records, with an absolute fallback at zero where a relative
 * one is meaningless.
 */
function within(actual: Decimal, expected: Decimal, label: string): void {
  const diff = actual.minus(expected).abs();
  const tolerance = expected.isZero()
    ? new Decimal("1e-20")
    : expected.abs().times("1e-25");
  const detail = `${label} diff=${diff.toString()} tolerance=${tolerance.toString()}`;
  expect(diff.lessThan(tolerance) ? detail : `${detail} EXCEEDED`).toBe(detail);
}

test("conversion round-trips for every currency (spec §10 property 1)", () => {
  for (const unit of UNITS) {
    for (const sample of SAMPLES) {
      const v = new Decimal(sample);
      const back = new Money(new Money(v, unit).to("eur"), "eur").to(unit);
      within(back, v, `${unit}:${sample}`);
    }
  }
});

test("conversion is transitive across every currency pair", () => {
  for (const a of UNITS) {
    for (const b of UNITS) {
      const direct = new Money(7, a).to("eur");
      const viaB = new Money(new Money(7, a).to(b), b).to("eur");
      within(viaB, direct, `${a}->${b}->eur`);
    }
  }
});

test("formatting never emits exponential notation for any currency", () => {
  for (const unit of UNITS) {
    for (const sample of ["1e41", "1e-22", ...SAMPLES]) {
      const formatted = new Money(sample, unit).toString();
      expect(`${unit} ${formatted}`).not.toMatch(/e[+-]\d/);
    }
  }
});

test("every currency formats with its own symbol and minor units", () => {
  for (const [unit, def] of Object.entries(CURRENCIES)) {
    const formatted = new Money(1, unit).toString();
    expect(formatted.startsWith(def.symbol)).toBe(true);
    const fraction = formatted.split(".")[1] ?? "";
    expect(`${unit}:${fraction.length}`).toBe(`${unit}:${def.minorUnits}`);
  }
});

test("KNOWN FAILURE: a money string does not parse back (spec §10 property 2)", () => {
  // Pinned, not skipped. Core's lexer allowlist contains only `%`, so a leading
  // currency symbol is *skipped* rather than rejected: `$30.00` evaluates to
  // `number` 30 — a silent kind change on a money string — and the facade
  // cannot read back its own output. The lexer change is ruled out of M3 (see
  // docs/superpowers/m2-followups.md). When it lands, this test fails and says
  // so, which is the point: the property being unattainable for `money` should
  // never be invisible.
  const rendered = new Money(30, "usd").toString();
  expect(rendered).toBe("$30.00");
  expect(() => Money.parse(rendered)).toThrow(UnitParseError);
  expect(engine.evaluate(rendered).kind).toBe("number");
  expect(engine.evaluate(rendered).value.canonical.toString()).toBe("30");

  // What does hold today: the unit-suffixed form round-trips through the
  // engine, and through the facade's own parser.
  expect(engine.evaluate("30 usd").formatted).toBe("$30.00");
  expect(Money.parse("30 usd").to("usd").toString()).toBe("30");
});

test("money formatting is lossy below the minor unit, by design", () => {
  // Distinct from the property above: even with a parseable rendering, money
  // formatting rounds to the minor unit, so `parse(format(v)) === v` can only
  // ever hold for values already at that scale. Arithmetic keeps full
  // precision — the rounding happens in the format hook and nowhere else.
  expect(new Money("30.004", "usd").toString()).toBe("$30.00");
  expect(new Money("30.004", "usd").value.toString()).toBe("30.004");
});
