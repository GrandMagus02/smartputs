import { describe, expect, test } from "bun:test";
import { english } from "@smartput/locale-en";
import { measure } from "@smartput/measure";
import measureEn from "@smartput/measure/locale/en";
import { composeLocale, defineVocabulary } from "../index";
import { assertLocaleContract } from "./locale";

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
