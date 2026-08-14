import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { measure } from "../index";
import measureDe from "./de";

/** Exactly what `german.selectForm` can return. */
const KEYS = ["dat-one", "dat-other", "nom-one", "nom-other"];

/**
 * `measure` is deliberately outside `BUILTIN_KINDS` (its mm/cm aliases collide
 * with `length`), so the barrel's contract test never reaches this vocabulary.
 * It gets the same three checks here.
 */
describe("de: measure, which the barrel never reaches", () => {
  test("key sets are exactly what selectForm produces", () => {
    for (const [unit, words] of Object.entries(measureDe.units)) {
      if (words.forms === undefined) continue;
      expect(Object.keys(words.forms).sort(), unit).toEqual(KEYS);
    }
  });

  test("every printed form and symbol is literally an alias", () => {
    for (const [unit, words] of Object.entries(measureDe.units)) {
      const aliases = new Set(words.aliases.map((a) => a.toLowerCase()));
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(aliases.has(form.toLowerCase()), `${unit} form ${key} = ${form}`).toBe(
          true,
        );
      }
      const sym = words.symbol;
      if (sym !== undefined && sym.trim() !== "") {
        expect(aliases.has(sym.toLowerCase()), `${unit} symbol ${sym}`).toBe(true);
      }
    }
  });

  test("contract and round-trip, fractional counts included", () => {
    const locale = composeLocale(german, [measureDe]);
    assertLocaleContract(locale, [measure], { counts: [0, 1, 2, 5, 100, 0.5, 1.5] });
    const engine = createEngine({ locales: [locale], kinds: [measure] });
    for (const [unit, words] of Object.entries(measureDe.units)) {
      const read = words.aliases[0] as string;
      for (const c of ["1", "2", "1500", "0,5"]) {
        const first = engine.evaluate(`${c} ${read}`);
        const back = engine.evaluate(first.formatted);
        expect(back.value.unit, `${unit}: ${first.formatted}`).toBe(first.value.unit);
        expect(
          back.value.canonical.eq(first.value.canonical),
          `${unit}: ${first.formatted}`,
        ).toBe(true);
      }
    }
  });
});
