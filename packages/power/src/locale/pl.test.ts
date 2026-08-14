import { describe, expect, test } from "bun:test";
import { aliasesFor, composeLocale, createEngine, Decimal } from "@smartput/core";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import { POWER_UNITS, type PowerUnit } from "../units";
import powerPl from "./pl";

const engine = () =>
  createEngine({
    locales: [composeLocale(polish, [powerPl])],
    kinds: [power],
  });

/** The key `polish` will index a unit's `forms` with, for this count/slot. */
const key = (unit: string, slot: "after-number" | "conversion-target", count?: number) =>
  polish.selectForm({
    ...(count !== undefined ? { count: new Decimal(count) } : {}),
    kind: "power",
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

/**
 * `power:w` prints a symbol it cannot read back, and `pl.ts`'s `RESERVED` set
 * says why at length: "w" is this language's conversion preposition, so `lex`
 * emits a keyword token for it and no alias index can claim it. This is English
 * `length:in` exactly — the one case `LocaleContractOptions.skipPrintable` was
 * written for — and taking it costs the same explaining. Everything else about
 * the unit is still asserted: its aliases resolve, its eight keys are checked,
 * and `formatValue` never reaches the symbol because the unit declares `forms`.
 */
const SKIP_PRINTABLE = ["power:w"];

describe("power pl vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerPl.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerPl.units)) {
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
    const descriptor = JSON.stringify(power);
    expect(descriptor).not.toMatch(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/u);
    for (const stem of ["wat", "kilowat", "wacie", "koń", "kon"]) {
      expect(descriptor, `the kind names "${stem}"`).not.toContain(stem);
    }
  });

  test("every unit but `hp` carries exactly the eight keys `selectForm` can produce", () => {
    // `hp` renders through its symbol; the entry in `pl.ts` says why Polish is
    // the one language here that cannot write the unit out.
    expect(powerPl.units.hp?.forms).toBeUndefined();
    for (const unit of ["w", "kw", "mw", "gw"]) {
      expect(Object.keys(powerPl.units[unit]?.forms ?? {}).sort(), unit).toEqual(
        EIGHT_KEYS,
      );
    }
  });

  // The one alias this vocabulary refuses, and the reason it is refused rather
  // than merely omitted. "KM" is what Polish writes for horsepower and it
  // case-folds to "km", which is the kilometre; the alias index is one flat map
  // with no kind in the key, so registering it would give "5 km" a second
  // reading in any engine that installs `@smartput/length` beside this one —
  // which is exactly what the `@smartput/kinds` barrel does. The collision would
  // not stay inside this package.
  test("`hp` claims no Polish abbreviation", () => {
    for (const word of powerPl.units.hp?.aliases ?? []) {
      expect(word.toLowerCase(), "hp claims the kilometre's surface").not.toBe("km");
    }
    expect(powerPl.units.hp?.symbol).toBe("hp");
  });

  // The other collision, and the opposite call: "w" *is* the watt's symbol, so
  // it cannot be given up, but it is also this language's `in` keyword, so the
  // alias has to be. `pl.ts`'s `RESERVED` set filters it out of the derived
  // list; leaving it in would put a dead entry in `registry.aliasIndex` that
  // `MatchCtx.isUnitAlias` reads and `@smartput/datetime`'s accept-gate acts on.
  test("`w` is filtered out of the derived aliases, because it is a keyword", () => {
    expect(aliasesFor(POWER_UNITS, "w")).toContain("w");
    expect(powerPl.units.w?.aliases).not.toContain("w");
    expect(powerPl.units.w?.symbol).toBe("W");
    // And the consequence, measured rather than asserted from the outside: a
    // Polish engine genuinely cannot read the symbol back, which is why
    // `power:w` is named in `skipPrintable` below.
    expect(() => engine().evaluate("5 W")).toThrow();
    // The words are the way in, and all three of them work.
    expect(engine().evaluate("5 wat").formatted).toBe("5 watów");
    expect(engine().evaluate("5 watów").formatted).toBe("5 watów");
    expect(engine().evaluate("5 watt").formatted).toBe("5 watów");
  });

  // The gap this closes is invisible to every other test here: a printed form
  // that is not a listed alias still round-trips, because `polish`'s suffix
  // stripper recovers it — at `weight: -2`. So "1 kW w wacie" resolves and
  // nothing fails, while the vocabulary quietly relies on a guess for a word it
  // had itself chosen to print. In Polish this is the check that catches the
  // locative singular: the stem-final `t` softens to `ci`, so "wacie" shares no
  // suffix boundary with "wat" and no ending table could have produced it.
  test("every form it prints is a form it reads", () => {
    for (const [unit, words] of Object.entries(powerPl.units)) {
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
      assertLocaleContract(composeLocale(polish, [powerPl]), [power], {
        skipPrintable: SKIP_PRINTABLE,
      }),
    ).not.toThrow();
    // The default counts are all integers, so they never ask for the "other"
    // category at all — in Polish that category is reached only by a fraction.
    // 1.5 is what makes the contract check the `nom-other`/`loc-other` rows this
    // vocabulary is likeliest to get wrong, since those two rows hold different
    // words and one word in both would still be eight keys.
    expect(() =>
      assertLocaleContract(composeLocale(polish, [powerPl]), [power], {
        skipPrintable: SKIP_PRINTABLE,
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("the four nominative rows are four different decisions", () => {
    // Masculine hard stem, and the row that separates Polish from both Slavic
    // neighbours: the genitive plural keeps its -ów. Russian and Ukrainian give
    // a unit named after a person a zero-ending counting form ("5 ватт", "5
    // ват"); Polish has no such rule, so `nom-one` and `nom-many` are different
    // words here where they are identical there.
    const w = powerPl.units.w?.forms;
    expect(w?.[key("w", "after-number", 1)]).toBe("wat");
    expect(w?.[key("w", "after-number", 2)]).toBe("waty");
    expect(w?.[key("w", "after-number", 5)]).toBe("watów");
    expect(w?.[key("w", "after-number", 1.5)]).toBe("wata");
    expect(w?.["nom-one"]).not.toBe(w?.["nom-many"]);
    // `nom-few` is a real nominative plural, so unlike Russian it does not
    // coincide with the fractional row either.
    expect(w?.["nom-few"]).not.toBe(w?.["nom-other"]);
  });

  test("21 is `many`, which is where Polish leaves Ukrainian and Russian", () => {
    // Both neighbours agree 21 with the singular; Polish says "dwadzieścia jeden
    // watów", a genitive plural, and every -1 above twenty goes the same way.
    expect(key("w", "after-number", 21)).toBe("nom-many");
    expect(key("w", "after-number", 101)).toBe("nom-many");
    expect(key("w", "after-number", 11)).toBe("nom-many");
    expect(key("w", "after-number", 22)).toBe("nom-few");
    expect(key("w", "after-number", 0)).toBe("nom-many");
  });

  test("case follows the slot, not the count", () => {
    // The two-axis contract, stated against the table rather than through the
    // formatter: the same count picks a nominative form after a number and a
    // locative one as a conversion target, and a target with no count at all
    // lands on `loc-other` — "w watach", the row a one-dimensional plural table
    // had no cell for.
    const w = powerPl.units.w?.forms;
    expect(w?.[key("w", "after-number", 5)]).toBe("watów");
    expect(w?.[key("w", "conversion-target", 5)]).toBe("watach");
    expect(key("w", "conversion-target")).toBe("loc-other");
    expect(w?.[key("w", "conversion-target")]).toBe("watach");
    // The locative singular softens the stem, so the case axis is not one suffix
    // applied to every count: "w 1 wacie", not "w 1 watach".
    expect(w?.[key("w", "conversion-target", 1)]).toBe("wacie");
    // The two `-other` rows hold different words, which is the trap
    // `polish.selectForm` documents: a genitive singular for the fraction, a
    // locative plural for the countless target.
    expect(w?.["nom-other"]).not.toBe(w?.["loc-other"]);
  });

  test("an engine built from it reads and writes Polish power", () => {
    const e = engine();
    // The numeral boundary, all four categories of it.
    expect(e.evaluate("1 wat").formatted).toBe("1 wat");
    expect(e.evaluate("2 waty").formatted).toBe("2 waty");
    expect(e.evaluate("5 watów").formatted).toBe("5 watów");
    // 21 is `many` in Polish, so this reads "21 watów" where a table ported from
    // Ukrainian or Russian would print the nominative singular "21 wat".
    expect(e.evaluate("21 watów").formatted).toBe("21 watów");
    // A sum that lands on a fraction — the assertion that would read
    // "1,5 kilowatów" if `nom-other` held a plural instead of the genitive
    // singular it is. Written with the word rather than the "w" symbol, because
    // the symbol is this language's keyword.
    expect(e.evaluate("1 kw + 500 watów").formatted).toBe("1,5 kilowata");
    // A conversion whose result groups: Polish groups thousands with U+00A0,
    // written here as an escape because a literal NBSP is invisible in source
    // and degrades to a plain space when someone retypes the line.
    expect(e.evaluate("1 kw w watach").formatted).toBe("1\u00A0000 watów");
    // Both spellings read: a Polish datasheet writes "2 kW" and gets Polish
    // back. Note that the prefixed symbols are unaffected by the keyword
    // collision — only the bare "w" is a Polish word.
    expect(e.evaluate("2 kW").formatted).toBe("2 kilowaty");
    expect(e.evaluate("1,5 kw").formatted).toBe("1,5 kilowata");
    // `hp` prints its Latin symbol, spaced by `polish.renderQuantity`, because
    // there is no Polish spelling it may claim.
    expect(e.evaluate("150 hp").formatted).toBe("150 hp");
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped conversion is in this list on purpose. Polish groups with
    // U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
    // plain space before `lex()` sees it, so "1\u00A0000 watów" would come back
    // as two numbers if `lex` did not accept that folded separator for a
    // language whose own separator is a non-breaking space. This is the one
    // input a Polish engine is guaranteed to be handed: its own output.
    for (const input of [
      "1 wat",
      "5 watów",
      "21 watów",
      "1 kw + 500 watów",
      "1 kw w watach",
      "2 kW",
      "150 hp",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });

  test("the Latin aliases are derived, never retyped — bar the one keyword", () => {
    // What keeps the micro path (`parsePower`) and the engine path in step:
    // every alias `units.ts` declares for a unit is still an alias of that unit
    // here, and the Polish spellings are an addition rather than a replacement.
    // The single exception is `RESERVED`, and it is named rather than tolerated.
    for (const unit of Object.keys(powerPl.units) as PowerUnit[]) {
      for (const derived of aliasesFor(POWER_UNITS, unit)) {
        if (derived === "w") continue;
        expect(powerPl.units[unit]?.aliases, `${unit} dropped "${derived}"`).toContain(
          derived,
        );
      }
    }
  });
});
