import { describe, expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { measure } from "@smartput/measure";
import measureEn from "@smartput/measure/locale/en";
import { Decimal } from "../decimal";
import { composeLocale, defineKind, defineVocabulary } from "../index";
import { ukrainian } from "../locale/uk";
import type { UnitWords, Vocabulary } from "../types";
import { assertLocaleContract, type LocaleContractOptions } from "./locale";

/**
 * The plan's fixtures are `@smartput/mass` and `@smartput/mass/locale/en`;
 * these are `@smartput/measure` and its vocabulary, which is the same shape —
 * a ratio kind whose `en` words are derived from its `units.ts` table — and is
 * one of the three `@smartput` packages core already declares as a
 * devDependency. Reaching for `mass` would mean adding a workspace edge (and a
 * `bun.lock` write) to a package core deliberately does not name, for a fixture
 * that is interchangeable.
 */
describe("assertLocaleContract", () => {
  test("passes for a complete language", () => {
    expect(() =>
      assertLocaleContract(composeLocale(english, [measureEn]), [measure]),
    ).not.toThrow();
  });

  test("fails when a unit has no words", () => {
    const partial = defineVocabulary({
      locale: "en",
      kind: "measure",
      units: {
        inch: {
          aliases: ["inch", "inches"],
          symbol: "inch",
          forms: { one: "inch", other: "inches" },
        },
      },
    });
    expect(() =>
      assertLocaleContract(composeLocale(english, [partial]), [measure]),
    ).toThrow(/measure:mm/);
  });

  test("fails when selectForm asks for a key the vocabulary lacks", () => {
    const gapped = defineVocabulary({
      locale: "en",
      kind: "measure",
      units: Object.fromEntries(
        Object.entries(measureEn.units).map(([u, w]) => [
          u,
          { ...w, forms: { one: w.forms?.one ?? u } },
        ]),
      ),
    });
    expect(() =>
      assertLocaleContract(composeLocale(english, [gapped]), [measure]),
    ).toThrow(/other/);
  });

  test("fails when an alias does not resolve back to its own unit", () => {
    const eaten = defineVocabulary({
      locale: "en",
      kind: "measure",
      units: {
        ...measureEn.units,
        // `millimetres` is `mm`'s word. Spelling `inch` with it does not make
        // the index forget `mm`, so the surface now has two readings inside one
        // kind and neither of them is "the inch".
        inch: { aliases: ["millimetres"], symbol: "inch" },
      },
    });
    expect(() =>
      assertLocaleContract(composeLocale(english, [eaten]), [measure]),
    ).toThrow();
  });

  test("a skipped unit is not asserted", () => {
    const partial = defineVocabulary({
      locale: "en",
      kind: "measure",
      units: Object.fromEntries(
        Object.entries(measureEn.units).filter(([u]) => u !== "px"),
      ),
    });
    expect(() =>
      assertLocaleContract(composeLocale(english, [partial]), [measure]),
    ).toThrow(/measure:px/);
    expect(() =>
      assertLocaleContract(composeLocale(english, [partial]), [measure], {
        skip: ["measure:px"],
      }),
    ).not.toThrow();
  });
});

/**
 * The other half of "resolves back", and the half that was missing: aliases are
 * what a user may *type*, `forms` and `symbol` are what the engine *answers*
 * with, and nothing checked that the second set was inside the first. Ukrainian
 * shipped four kinds that could not read their own output with the alias check
 * above green.
 */
describe("assertLocaleContract: the strings the printer emits", () => {
  /** The collected problems, so a test can name the one it expects. */
  const problemsFrom = (run: () => void): string => {
    try {
      run();
    } catch (error) {
      return (error as Error).message;
    }
    throw new Error("assertLocaleContract was expected to throw and did not");
  };

  /** `measureEn` with one unit's words patched — the whole vocabulary, so
   * every *other* unit stays correct and the message names only this one. */
  const measureWith = (unit: string, patch: Partial<UnitWords>) =>
    defineVocabulary({
      locale: "en",
      kind: "measure",
      units: Object.fromEntries(
        Object.entries(measureEn.units).map(([u, w]) => [
          u,
          u === unit ? { ...w, ...patch } : w,
        ]),
      ),
    });

  const assertMeasure = (vocab: Vocabulary, opts?: LocaleContractOptions) => () =>
    assertLocaleContract(composeLocale(english, [vocab]), [measure], opts);

  test("fails when a printed form is a word the aliases do not claim", () => {
    // The defect in miniature: a plural nobody listed. English strips "s", so
    // the analyzer offers "pixle", which is not an alias either — a form no
    // route recovers, which is exactly what "5 pixles" would do to a reader.
    const message = problemsFrom(
      assertMeasure(measureWith("px", { forms: { one: "pixel", other: "pixles" } })),
    );
    expect(message).toContain('measure:px prints "pixles"');
    expect(message).toContain('form "other"');
    // The unit's own aliases are fine, so nothing else about it is reported.
    expect(message).not.toContain("does not resolve back");
  });

  test("fails when a printed symbol is one the aliases do not claim", () => {
    expect(assertMeasure(measureWith("px", { symbol: "pxl" }))).toThrow(
      /measure:px prints "pxl" \(symbol\)/,
    );
  });

  test("a form recovered only by a penalised stripper still counts as readable", () => {
    // "pixels" is not in this table's aliases; the stripper turns it into
    // "pixel", which is. A penalised reading is a reading — the engine ranks it
    // against the alternatives rather than refusing it — so this passes.
    expect(
      assertMeasure(
        measureWith("px", {
          aliases: ["px", "pixel"],
          forms: { one: "pixel", other: "pixels" },
        }),
      ),
    ).not.toThrow();
  });

  test("a compound symbol is read as arithmetic, so it is out of scope", () => {
    // English "m/s" is not an alias and never was: the lexer ends the word
    // token at "/" and length / duration computes to a speed. An alias lookup
    // cannot decide such a symbol either way, so the check leaves it alone —
    // what catches a broken one is an evaluation test in the kind's own
    // package, since whether it computes depends on a registered signature.
    expect(assertMeasure(measureWith("px", { symbol: "px/inch" }))).not.toThrow();
  });

  test("a symbol that prints nothing is not a string to read back", () => {
    // `@smartput/number` ships `symbol: ""` deliberately: R8 wants an explicit
    // symbol on every unit, and the number kind's formatter returns the bare
    // numeral before any symbol is read.
    expect(assertMeasure(measureWith("px", { symbol: "" }))).not.toThrow();
  });

  test("skipPrintable waives the printed strings and nothing else", () => {
    const skipPrintable = ["measure:px"];
    expect(
      assertMeasure(measureWith("px", { symbol: "pxl" }), { skipPrintable }),
    ).not.toThrow();
    // Still asserted for that same unit: its aliases, and the `forms` keys the
    // language will ask for. This is what `skip` would have thrown away.
    expect(
      assertMeasure(measureWith("px", { symbol: "pxl", forms: { one: "pixel" } }), {
        skipPrintable,
      }),
    ).toThrow(/measure:px has no form "other"/);
    expect(
      assertMeasure(measureWith("px", { symbol: "pxl", aliases: ["millimetres"] }), {
        skipPrintable,
      }),
    ).toThrow(/does not resolve back/);
  });
});

/**
 * The check against the tree it was written for: `@smartput/power`'s Ukrainian
 * vocabulary as it stood at b0cb72d^, one commit before the fix. "1 hp" printed
 * "1 кінська сила" and threw `Unknown unit "кінська"` on its own output, and
 * every test in the repo passed — including `assertLocaleContract`, which read
 * the two Latin aliases, found them fine, and never looked at the eight forms.
 *
 * The two rows are copied verbatim out of git history; the kind beneath them is
 * a two-unit stand-in for the real `power`, because core does not depend on that
 * package and the check reads nothing but words and unit ids anyway. `w` is
 * included precisely to show the report is specific: a correct row beside a
 * broken one is not named.
 *
 * This is the proof the check has teeth. A check that passes on today's tree and
 * would also have passed on that one is worth nothing.
 */
describe("assertLocaleContract: the pre-fix Ukrainian horsepower table", () => {
  const power = defineKind({
    id: "power",
    value: {
      mode: "ratio",
      canonical: "w",
      units: { w: 1, hp: new Decimal("745.69987158227022") },
    },
  });

  const powerUkBeforeTheFix = defineVocabulary({
    locale: "uk",
    kind: "power",
    units: {
      w: {
        aliases: [
          "w",
          "watt",
          "watts",
          "Вт",
          "ват",
          "вата",
          "вату",
          "ваті",
          "вати",
          "ватів",
          "ватам",
          "ватах",
          "ватом",
          "ватами",
        ],
        symbol: "Вт",
        forms: {
          "nom-one": "ват",
          "nom-few": "вати",
          "nom-many": "ватів",
          "nom-other": "вата",
          "loc-one": "ваті",
          "loc-few": "ватах",
          "loc-many": "ватах",
          "loc-other": "ватах",
        },
      },
      hp: {
        aliases: ["hp", "horsepower"],
        symbol: "к.с.",
        forms: {
          "nom-one": "кінська сила",
          "nom-few": "кінські сили",
          "nom-many": "кінських сил",
          "nom-other": "кінської сили",
          "loc-one": "кінській силі",
          "loc-few": "кінських силах",
          "loc-many": "кінських силах",
          "loc-other": "кінських силах",
        },
      },
    },
  });

  test("is caught, phrase by phrase, and the correct row beside it is not", () => {
    let message = "";
    try {
      assertLocaleContract(composeLocale(ukrainian, [powerUkBeforeTheFix]), [power]);
    } catch (error) {
      message = (error as Error).message;
    }
    // Every phrase the printer could emit, each named once.
    for (const phrase of [
      "кінська сила",
      "кінські сили",
      "кінських сил",
      "кінської сили",
      "кінській силі",
      "кінських силах",
    ]) {
      expect(message, phrase).toContain(`power:hp prints "${phrase}"`);
    }
    expect(message).toContain("a unit word is one token");
    // And the abbreviation, which fails one step further down the same lexer:
    // "." is not a letter, so "150 к.с." arrives as "к" then "с". It is a single
    // run of characters rather than a phrase, so it is reported as the plainer
    // thing — a printed string with no reading.
    expect(message).toContain('power:hp prints "к.с." (symbol) but cannot read it back');
    // The watt row is correct in that same file and is not mentioned.
    expect(message).not.toContain("power:w");
  });
});
