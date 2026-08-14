import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { portuguese } from "@smartput/core/locale/pt";
import { assertLocaleContract } from "@smartput/core/testing";
import { number } from "@smartput/number";
import numberPt from "@smartput/number/locale/pt";
import { percent } from "../index";
import percentPt from "./pt";

const locale = composeLocale(portuguese, [percentPt]);
const engine = () => createEngine({ locales: [locale], kinds: [percent] });

/** Anything only Portuguese would write — the tilde and the rest of the accents. */
const PORTUGUESE = /[ãõáéíóúàâêôç]/i;

describe("percent pt vocabulary", () => {
  test("it targets Portuguese and names its kind by id", () => {
    expect(percentPt.locale).toBe("pt");
    expect(percentPt.kind).toBe("percent");
  });

  test("covers every unit the kind declares", () => {
    const units = Object.keys(percent.value.mode === "ratio" ? percent.value.units : {});
    expect(Object.keys(percentPt.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(percentPt.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `en.test.ts`'s "the kind itself carries no English word": a kind
  // is one ratio and one unit id, so nothing a language wrote may reach it.
  // Portuguese shares the Latin script with the kind's own ids, so the grep is for
  // what only Portuguese writes — the accents — plus the words this file adds.
  test("the kind itself carries no Portuguese word", () => {
    const source = JSON.stringify(percent);
    expect(source).not.toMatch(PORTUGUESE);
    expect(source).not.toMatch(/porcento|porcentagem|percentagem|percentual/i);
  });

  // The Latin half is reused from the one alias map in `units.ts` rather than
  // retyped, so a Portuguese engine still reads "20 pct" and the micro path cannot
  // drift; the Portuguese half is appended.
  test("reuses the Latin aliases and appends the Portuguese ones", () => {
    const aliases = percentPt.units["%"]?.aliases ?? [];
    for (const latin of ["%", "percent", "percents", "pct", "pcts"]) {
      expect(aliases, latin).toContain(latin);
    }
    for (const word of [
      "porcento",
      "porcentagem",
      "porcentagens",
      "percentagem",
      "percentagens",
      "percentual",
      "percentuais",
    ]) {
      expect(aliases, word).toContain(word);
    }
    expect(aliases.length).toBe(new Set(aliases).size);
  });

  // The one place Portuguese morphology bites this package, and the reason the
  // plurals are written out rather than left to the analyzer chain. "-agem" takes
  // "-agens" — the -m → -ns class `pt.ts` deliberately declares no rule for — so
  // "porcentagens" is reachable by nothing unless it is listed. "percentuais" is
  // the -l → -is class, which the language *does* rewrite, and this is the
  // measurement of the difference: the unlisted spelling is recovered only by the
  // penalised rewrite, the listed one is exact.
  test("the -m plural is unreachable without this file, and the -l plural is only penalised", () => {
    const e = engine();
    expect(e.evaluate("20 porcentagens").value?.unit).toBe("%");
    expect(e.evaluate("20 percentuais").value?.unit).toBe("%");
    // A word this file did *not* list, in the same -m class, to prove the absence
    // of the rule rather than assert it: nothing folds "-agens" back to "-agem".
    expect(() => e.evaluate("20 viagens")).toThrow();
  });

  // No `forms`, and for `en`'s reason rather than `uk`'s: Portuguese has an
  // ordinary noun here and would owe only two rows, so nothing had to be invented
  // — the written form of this unit is simply the symbol. Where the `en` unit
  // decided against word forms, this file does not add them.
  test("no unit declares forms", () => {
    for (const words of Object.values(percentPt.units)) {
      expect(words.forms).toBeUndefined();
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [percent])).not.toThrow();
    // A fractional count is added even though this vocabulary has no `forms` for
    // the contract's form sweep to reach: the default counts are all integers, the
    // sweep is skipped here either way, and the alias half of the contract is what
    // carries this kind — running the same call shape as every other `pt`
    // vocabulary keeps the row comparable. In Portuguese the fraction is also the
    // count that would have selected the *singular* row, which is the opposite of
    // English and the reason it is never left out of a `pt` sweep.
    expect(() =>
      assertLocaleContract(locale, [percent], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("selectForm answers two keys this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      portuguese.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "percent",
        unit: "%",
        slot,
      });
    expect(key(1, "after-number")).toBe("one");
    expect(key(2, "after-number")).toBe("other");
    // The Portuguese rows a translator coming from English gets wrong: 0 and 1,5
    // both select the *singular* (CLDR's `i = 0..1`), and a million is the folded
    // `many`. A conversion target with no count at all lands on `other` (R5). None
    // of them find a table here, which is why the output below does not move
    // across any of them.
    expect(key(0, "after-number")).toBe("one");
    expect(key(1.5, "after-number")).toBe("one");
    expect(key(1_000_000, "after-number")).toBe("other");
    expect(key(undefined, "conversion-target")).toBe("other");
    expect(percentPt.units["%"]?.forms).toBeUndefined();
  });

  test("an engine built from it reads and writes Portuguese percentages", () => {
    const e = engine();
    // The plural boundary, and the point of a symbol-only unit: the output does
    // *not* move across it. 1 selects `one` and 2 selects `other`, but there is no
    // `forms` table to index, so both render through `symbol`.
    expect(e.evaluate("1 porcento").formatted).toBe("1%");
    expect(e.evaluate("2 porcento").formatted).toBe("2%");
    expect(e.evaluate("5 porcentagens").formatted).toBe("5%");
    expect(e.evaluate("5 percentagem").formatted).toBe("5%");
    expect(e.evaluate("5 percentual").formatted).toBe("5%");
    // The fractional row — "," as the decimal mark, read from CLDR by
    // `numberFormat: "intl"` — and the row Portuguese calls singular, printed
    // identically because there is no word to inflect.
    expect(e.evaluate("1,5 porcento").formatted).toBe("1,5%");
    // Grouped output, with Brazilian "." as the group mark. Unlike Ukrainian's
    // U+00A0 this survives `normalize()`, so it is asserted *and* round-tripped
    // below rather than only asserted.
    expect(e.evaluate("2000 porcentagem").formatted).toBe("2.000%");
    // Both halves of the alias list read: the Latin ones come from the one map in
    // `units.ts`, because recognition is many-to-one and generation is one.
    expect(e.evaluate("50 pct").formatted).toBe("50%");
    // The `of` operator through its Portuguese keyword ("de"), and `off` through
    // the noun "desconto" that `pt.ts` adds rather than ship a language whose
    // operator is unspellable.
    expect(e.evaluate("20% de 50").formatted).toBe("10");
    expect(e.evaluate("20% desconto 50").formatted).toBe("40");
    // A sum that lands on a fraction, in the unit it was typed in.
    expect(e.evaluate("1 porcento mais 0,5 porcento").formatted).toBe("1,5%");
  });

  // The trade `pt.ts` makes on "por", recorded as a live assertion instead of a
  // comment — and inherited rather than chosen, since Spanish claims the same
  // surface for the same operation and `buildKeywords` throws on boot if two
  // installed languages disagree. "por cento" is what Portuguese actually writes,
  // it is two tokens, and both fragments are claimed: "por" is the `times` keyword
  // and "cento" is the combining form of the hundred in `CARDINALS`. So the phrase
  // does not fail — it multiplies.
  test("records that the two-token phrase reads as arithmetic, not as a unit", () => {
    const e = createEngine({ locales: [locale], kinds: [percent, number] });
    const result = e.evaluate("20 por cento");
    expect(result.value?.kind).toBe("number");
    expect(result.value?.canonical.toString()).toBe("2000");
    // The single-token spellings are the ones that reach the unit, which is why
    // they are listed at all.
    expect(e.evaluate("20 porcento").value?.kind).toBe("percent");
  });

  // The conversion, which for this kind is the `in|number|percent` op rather than
  // a unit-to-unit change — percent has exactly one unit, so the only conversion it
  // can be the target of comes from outside the kind. It needs `number`
  // registered, and it is tried through both of Portuguese's `in` keywords: "em"
  // is the locative preposition and "para" the directional one, and a unit
  // reachable through only one of them stops resolving the moment a user picks the
  // other.
  test("reads a conversion into percent through both `in` keywords", () => {
    const e = createEngine({
      locales: [composeLocale(portuguese, [percentPt, numberPt])],
      kinds: [percent, number],
    });
    expect(e.evaluate("5 / 50 em porcentagem").formatted).toBe("10%");
    expect(e.evaluate("5 / 50 para %").formatted).toBe("10%");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped row is in the loop, unlike the Ukrainian file's: Portuguese
    // groups with "." and `normalize()`'s NFKC pass leaves it alone, so "2.000%"
    // lexes back as one quantity where "2 000%" could not.
    for (const input of [
      "2 porcento",
      "5 porcentagens",
      "1,5 porcento",
      "2000 porcentagem",
      "50 pct",
      "1 porcento mais 0,5 porcento",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
