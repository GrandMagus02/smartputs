import { describe, expect, test } from "bun:test";
import { aliasesFor, composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import { ENERGY_UNITS, type EnergyUnit } from "../units";
import energyPl from "./pl";

const engine = () =>
  createEngine({
    locales: [composeLocale(polish, [energyPl])],
    kinds: [energy],
  });

/** The key `polish` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  polish.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "energy",
    unit,
    slot,
  });

/**
 * Exactly what `polish.selectForm` can produce: `` `${case}-${category}` `` over
 * {nom, loc} × CLDR's four Polish categories. No more and no fewer — a table
 * with a ninth key is indexing something the engine will never ask for, and one
 * with seven has a cell that renders `undefined` at a user.
 */
const EIGHT_KEYS = [
  "loc-few",
  "loc-many",
  "loc-one",
  "loc-other",
  "nom-few",
  "nom-many",
  "nom-one",
  "nom-other",
];

/** The one unit that declares no `forms`, and the entry in `pl.ts` says why. */
const FORMLESS = ["btu"];

describe("energy pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyPl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyPl.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The mirror of `ru.test.ts`'s "the kind itself carries no Russian word", and
  // it needs two halves rather than one because Polish is written in the Latin
  // alphabet. A Cyrillic-block regex is a complete proxy for Russian — any
  // Cyrillic letter in the descriptor is a leak — and Polish has no such block
  // to point at. So the diacritics do the first half, and the vocabulary's own
  // distinctively Polish stems do the second.
  test("the kind itself carries no Polish word", () => {
    const descriptor = JSON.stringify(energy);
    expect(descriptor).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u);
    for (const stem of ["dżul", "dzul", "kaloria", "kalorii", "watogodzin"]) {
      expect(descriptor, `the kind names "${stem}"`).not.toContain(stem);
    }
  });

  test("every unit but `btu` carries exactly the eight keys `selectForm` can produce", () => {
    for (const [unit, words] of Object.entries(energyPl.units)) {
      if (FORMLESS.includes(unit)) {
        expect(words.forms, `${unit} declares a form`).toBeUndefined();
        continue;
      }
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual(EIGHT_KEYS);
    }
  });

  // The departure from every other language in this package, asserted rather
  // than merely written down. `en.ts`, `de.ts` and `ru.ts` all leave the
  // watt-hour family formless because their word for it is not one token — two
  // words in English, a hyphenated compound in Russian, an interpunct symbol in
  // both. Polish fuses it into one ordinary feminine noun, so the reason to omit
  // is absent and the words ship. If a later edit removes them, this names the
  // cause instead of leaving the file looking like the others by accident.
  test("the watt-hour family declares Polish words, unlike its siblings", () => {
    expect(energyPl.units.kwh?.forms?.["nom-one"]).toBe("kilowatogodzina");
    expect(energyPl.units.kwh?.forms?.["nom-many"]).toBe("kilowatogodzin");
    for (const unit of ["wh", "kwh", "mwh"]) {
      const forms = energyPl.units[unit]?.forms ?? {};
      for (const form of Object.values(forms)) {
        // One token, because that is the whole reason these rows are allowed to
        // exist: a space or a slash in any of them and the printer would emit
        // something the lexer cannot take back.
        expect(form, `${unit} prints a multi-token word`).not.toMatch(/[\s/·]/u);
      }
    }
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `polish`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 kJ w dżulu" resolves and
  // nothing fails, while the vocabulary quietly relies on a guess for a word it
  // had itself chosen to print. Asserting the containment is what keeps the two
  // halves of a unit's entry — what it writes and what it reads — in step, and
  // here it is the check that catches `kaloria`'s four-way syncretism and the
  // bare-stem genitive plural "watogodzin", which no ending table produces.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(energyPl.units)) {
      for (const [formKey, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${formKey}="${form}" but does not list it`,
        ).toContain(form);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(polish, [energyPl]), [energy]),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Polish that category is reached only by a fraction.
    // 1.5 is what makes the contract check the `nom-other`/`loc-other` rows this
    // vocabulary is likeliest to get wrong, since those two rows hold different
    // words and one word in both would still be eight keys.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [energyPl]), [energy], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the four nominative rows are four different decisions", () => {
    // Masculine soft stem. `nom-few` is a real nominative plural, so unlike
    // Russian it does not coincide with the fractional row: "2 dżule" against
    // "1,5 dżula".
    const j = energyPl.units.j?.forms;
    expect(j?.[key("j", "after-number", 1)]).toBe("dżul");
    expect(j?.[key("j", "after-number", 2)]).toBe("dżule");
    expect(j?.[key("j", "after-number", 5)]).toBe("dżuli");
    expect(j?.[key("j", "after-number", 1.5)]).toBe("dżula");
    // `kaloria` is the counter-example that makes the point about coincidences:
    // an -ia feminine spells its genitive singular, its locative singular and
    // its genitive plural all "kalorii", so three keys share one word for three
    // different grammatical reasons — and `nom-few` is still its own "kalorie".
    const cal = energyPl.units.cal?.forms;
    expect(cal?.[key("cal", "after-number", 2)]).toBe("kalorie");
    expect(cal?.[key("cal", "after-number", 5)]).toBe("kalorii");
    expect(cal?.[key("cal", "after-number", 1.5)]).toBe("kalorii");
    expect(cal?.[key("cal", "conversion-target", 1)]).toBe("kalorii");
  });

  test("21 is `many`, which is where Polish leaves Ukrainian and Russian", () => {
    // Both neighbours agree 21 with the singular; Polish says "dwadzieścia jeden
    // dżuli", a genitive plural, and every -1 above twenty goes the same way.
    expect(key("j", "after-number", 21)).toBe("nom-many");
    expect(key("j", "after-number", 101)).toBe("nom-many");
    expect(key("j", "after-number", 11)).toBe("nom-many");
    expect(key("j", "after-number", 22)).toBe("nom-few");
    expect(key("j", "after-number", 0)).toBe("nom-many");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // locative one as a conversion target, and a target with no count at all
    // lands on `loc-other` — "w dżulach", the row a one-dimensional plural table
    // had no cell for.
    const j = energyPl.units.j?.forms;
    expect(j?.[key("j", "after-number", 5)]).toBe("dżuli");
    expect(j?.[key("j", "conversion-target", 5)]).toBe("dżulach");
    expect(key("j", "conversion-target")).toBe("loc-other");
    expect(j?.[key("j", "conversion-target")]).toBe("dżulach");
    // A soft stem takes -u in the locative singular rather than the -e that
    // would soften it, so the case axis is not one suffix applied to every
    // count: "w 1 dżulu", not "w 1 dżulach".
    expect(j?.[key("j", "conversion-target", 1)]).toBe("dżulu");
    // The two `-other` rows hold different words, which is the trap
    // `polish.selectForm` documents: a genitive singular for the fraction, a
    // locative plural for the countless target.
    expect(j?.["nom-other"]).not.toBe(j?.["loc-other"]);
  });

  test("an engine built from it reads and writes Polish energy", () => {
    const e = engine();
    // The numeral boundary, all four categories of it.
    expect(e.evaluate("1 dżul").formatted).toBe("1 dżul");
    expect(e.evaluate("2 dżule").formatted).toBe("2 dżule");
    expect(e.evaluate("5 dżuli").formatted).toBe("5 dżuli");
    // 21 is `many` in Polish, so this reads "21 dżuli" where a table ported from
    // Ukrainian or Russian would print the nominative singular.
    expect(e.evaluate("21 dżuli").formatted).toBe("21 dżuli");
    // A sum that lands on a fraction — the assertion that would read
    // "1,5 kilodżuli" if `nom-other` held a plural instead of the genitive
    // singular it is.
    expect(e.evaluate("1 kj + 500 j").formatted).toBe("1,5 kilodżula");
    // A conversion whose result groups: Polish groups thousands with U+00A0,
    // written here as an escape because a literal NBSP is invisible in source
    // and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("1 kj w dżulach").formatted).toBe("1\u00A0000 dżuli");
    expect(e.evaluate("2 kcal w dżulach").formatted).toBe("8\u00A0368 dżuli");
    // The watt-hour family, which prints a Polish word here where every sibling
    // language prints a symbol.
    expect(e.evaluate("5 kwh").formatted).toBe("5 kilowatogodzin");
    expect(e.evaluate("5 kilowatogodzin").formatted).toBe("5 kilowatogodzin");
    expect(e.evaluate("1 kwh w dżulach").formatted).toBe("3\u00A0600\u00A0000 dżuli");
    // `btu` declares no forms and needs none: `polish.renderQuantity` spaces the
    // symbol branch, so the invariant initialism comes out right on its own.
    expect(e.evaluate("1 btu").formatted).toBe("1 BTU");
    // The -ia feminine, whose genitive plural keeps its -i rather than dropping
    // to a bare stem.
    expect(e.evaluate("5 kcal").formatted).toBe("5 kilokalorii");
    expect(e.evaluate("2 kalorie").formatted).toBe("2 kalorie");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversions are in this list on purpose. Polish groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "1\u00A0000 dżuli" would come back
    // as two numbers if `lex` did not accept that folded separator for a
    // language whose own separator is a non-breaking space. This is the one
    // input a Polish engine is guaranteed to be handed: its own output.
    for (const input of [
      "1 dżul",
      "5 dżuli",
      "1 kj + 500 j",
      "1 kj w dżulach",
      "2 kcal w dżulach",
      "5 kwh",
      "1 btu",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });

  test("the Latin aliases are derived, never retyped", () => {
    // What keeps the micro path (`parseEnergy`) and the engine path in step:
    // every alias `units.ts` declares for a unit is still an alias of that unit
    // here, and the Polish spellings are an addition rather than a replacement.
    //
    // With one deliberate hole, and `pl.ts`'s `RESERVED` is where it is argued.
    // "cal" is the ordinary Polish noun for the *inch*, and
    // `@smartput/length/locale/pl` prints it as that unit's `nom-one` — so while
    // this vocabulary also claimed it, a `BUILTIN_KINDS` engine speaking only
    // Polish threw `AmbiguityError: "1 cal" is ambiguous between energy:cal,
    // length:in` on the length vocabulary's own output. The inch keeps the
    // surface because it is the one that prints it; the calorie keeps `kaloria`,
    // which nothing else claims.
    const RESERVED = new Set(["cal"]);
    for (const unit of Object.keys(energyPl.units) as EnergyUnit[]) {
      for (const derived of aliasesFor(ENERGY_UNITS, unit)) {
        if (RESERVED.has(derived)) {
          expect(
            energyPl.units[unit]?.aliases,
            `${unit} kept reserved "${derived}"`,
          ).not.toContain(derived);
          continue;
        }
        expect(energyPl.units[unit]?.aliases, `${unit} dropped "${derived}"`).toContain(
          derived,
        );
      }
    }
  });

  // The half of the reservation that can be asserted from inside this package:
  // the surface is gone from the index, and every Polish word for the calorie is
  // still in it. The other half — that a two-kind Polish engine now resolves
  // "1 cal" as an inch — needs `@smartput/length` beside this kind and lives in
  // `@smartput/kinds`'s `zz-pl-verify.test.ts`, which is the one package that
  // may import both.
  test('"cal" is no longer read as a calorie in Polish', () => {
    const e = engine();
    expect(energyPl.units.cal?.aliases).not.toContain("cal");
    expect(() => e.evaluate("1 cal")).toThrow();
    expect(e.evaluate("5 kalorii").value?.unit).toBe("cal");
    expect(e.evaluate("1 kaloria").value?.unit).toBe("cal");
    // The English spellings `units.ts` derives are untouched — only the symbol
    // was reserved — and so is "kcal", which never collided with anything and is
    // the form a Polish reader actually types for food energy.
    expect(e.evaluate("5 calories").value?.unit).toBe("cal");
    expect(e.evaluate("5 kcal").formatted).toBe("5 kilokalorii");
  });
});
