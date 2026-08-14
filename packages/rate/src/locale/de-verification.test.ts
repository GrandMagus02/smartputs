import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { number } from "@smartput/number";
import numberDe from "@smartput/number/locale/de";
import moneyDe from "@smartput/rate/locale/de";
import { money } from "../money";
import { snapshot } from "../snapshot";

/** Exactly what `german.selectForm` can return. */
const KEYS = ["dat-one", "dat-other", "nom-one", "nom-other"];

/**
 * The three `de` vocabularies that are deliberately NOT in `BUILTIN_DE` —
 * `measure` collides with `length`, `money` needs a rate table, `datetime` is
 * opaque — and are therefore never reached by the barrel's contract test.
 */
describe("de: the off-barrel vocabularies", () => {
  test("key sets are exactly what selectForm produces", () => {
    const bad: string[] = [];
    for (const v of [moneyDe, numberDe]) {
      for (const [unit, words] of Object.entries(v.units)) {
        if (words.forms === undefined) continue;
        const got = Object.keys(words.forms).sort();
        if (JSON.stringify(got) !== JSON.stringify(KEYS)) {
          bad.push(`${v.kind}:${unit} keys ${JSON.stringify(got)}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  test("every printed form is literally an alias", () => {
    const bad: string[] = [];
    for (const v of [moneyDe]) {
      for (const [unit, words] of Object.entries(v.units)) {
        const aliases = new Set(words.aliases.map((a) => a.toLowerCase()));
        for (const [key, form] of Object.entries(words.forms ?? {})) {
          if (!aliases.has(form.toLowerCase())) {
            bad.push(
              `${v.kind}:${unit} form ${key}=${JSON.stringify(form)} is not an alias`,
            );
          }
        }
      }
    }
    expect(bad).toEqual([]);
  });

  test("money round-trips every word German claims", () => {
    const rates = snapshot("EUR", "2026-08-04", {
      USD: 1.1,
      GBP: 0.8412,
      UAH: 45,
      PLN: 4.3,
      JPY: 160,
      CHF: 0.94,
    });
    const engine = createEngine({
      locales: [composeLocale(german, [numberDe, moneyDe])],
      kinds: [number, money],
      rates,
    });
    const quoted = new Set(["eur", "usd", "gbp", "uah", "pln", "jpy", "chf"]);
    for (const [unit, words] of Object.entries(moneyDe.units)) {
      if (words.forms === undefined || !quoted.has(unit)) continue;
      for (const form of new Set(Object.values(words.forms))) {
        // The German-specific half: the word this table PRINTS is a word the
        // engine READS, and it reaches the currency the table claims it does.
        //
        // Deliberately not asserted here: that `first.formatted` parses back.
        // Money formats through the kind's own hook, which prints the currency
        // *sign* ("€5,00"), and reading that back yields `number:one` in en, uk
        // and de alike — a property of the money kind, not of this translation.
        const first = engine.evaluate(`5 ${form}`);
        // The canonical is in the snapshot's base currency, so it equals 5 only
        // for EUR itself — the unit is what identifies the reading here.
        expect(first.value.unit, `"5 ${form}" read as ${first.value.unit}`).toBe(unit);
      }
    }
  });
});
