import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { area } from "../index";
import areaFr from "./fr";

const fr = composeLocale(french, [areaFr]);
const engine = createEngine({ locales: [fr], kinds: [area] });

/**
 * The two keys `french.selectForm` can return. Written out rather than derived
 * so that a language that grew a third category would fail *here*, on a list
 * somebody has to read, instead of silently leaving every table below a row
 * short — a live possibility for French rather than a hypothetical one:
 * `Intl.PluralRules("fr")` declares three categories and `fr.ts` folds the
 * third away on purpose.
 */
const KEYS = ["one", "other"];

/** The units that have words at all — the squared three print through `symbol`. */
const SPELLED = ["hectare", "acre"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = french.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "area",
    unit,
    slot,
  });
  return (areaFr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

describe("area fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(area.value.mode === "ratio" ? area.value.units : {});
    expect(Object.keys(areaFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(areaFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no French word", () => {
    // French shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses. Two checks instead: no French
    // orthography (the accented vowels and the cedilla, none of which an ASCII
    // unit id can contain), and none of the two-word squared names, which are
    // the only French wording this kind could plausibly have leaked.
    expect(JSON.stringify(area)).not.toMatch(/[àâäéèêëîïôöùûüÿç]/i);
    expect(JSON.stringify(area)).not.toMatch(/carré|cube/i);
  });

  test("only the two named units carry forms, and they carry exactly the key set", () => {
    // Rule 6: no more keys and no fewer, on the units that have words at all.
    // `m²`, `cm²` and `km²` have none on purpose — "mètre carré" is two words
    // and `lex` ends a word token at the space — so their absence is the
    // assertion here rather than an exemption from one.
    for (const [unit, words] of Object.entries(areaFr.units)) {
      if (SPELLED.includes(unit)) {
        expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual([...KEYS].sort());
      } else {
        expect(words.forms, `${unit} should print through its symbol`).toBeUndefined();
      }
    }
    // ...and the list above is the whole of what the language can ask for,
    // swept over the counts that separate French's categories: 0, 1 and every
    // fraction below two are `one`, 1e6 is CLDR's `many` before
    // `french.selectForm` folds it into `other`, and the rest are `other`.
    const seen = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [0, 1, 1.5, 1.9, 2, 5, 11, 21, 100, 1000, 1e6]) {
        seen.add(
          french.selectForm({
            count: new Decimal(count),
            kind: "area",
            unit: "hectare",
            slot,
          }),
        );
      }
      seen.add(french.selectForm({ kind: "area", unit: "hectare", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared. Here every word
    // arrives from `units.ts` — French and English spell both nouns identically
    // — so what this really pins is that the reuse was not skipped.
    for (const [unit, words] of Object.entries(areaFr.units)) {
      for (const form of Object.values(words.forms ?? {})) {
        expect(words.aliases, `${unit} prints ${form}`).toContain(form);
      }
      if (words.symbol !== undefined) {
        expect(words.aliases, `${unit} prints ${words.symbol}`).toContain(words.symbol);
      }
    }
  });

  test("every alias is unique within the kind, so no reading is ambiguous", () => {
    const seen = new Map<string, string>();
    for (const [unit, words] of Object.entries(areaFr.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by ${seen.get(alias)} too`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  test("no unit word is a phrase", () => {
    // The rule `assertLocaleContract` states in as many words, restated here on
    // the vocabulary alone because this is the kind where breaking it is
    // tempting: "mètre carré" is the correct French name for `m2` and it can
    // never be a unit word, because `lex` builds a word token out of a run of
    // letters and a space ends it.
    for (const [unit, words] of Object.entries(areaFr.units)) {
      for (const surface of [...words.aliases, words.symbol ?? ""]) {
        expect(/\s/u.test(surface), `${unit} declares the phrase ${surface}`).toBe(false);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(fr, [area])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so without this sweep the fractional
    // category is never reached at all. For French that is the category the
    // whole language differs from English on: 1,5 selects `one`, not `other`,
    // and a table that had copied English's two columns would still pass every
    // integer row above.
    assertLocaleContract(fr, [area], {
      counts: [0, 1, 1.5, 1.9, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("singular below two, plural from two — the French boundary", () => {
    expect(word("hectare", 1)).toBe("hectare");
    // The two rows English gets wrong. French writes the singular on zero and
    // on every fraction under two.
    expect(word("hectare", 0)).toBe("hectare");
    expect(word("hectare", 1.5)).toBe("hectare");
    expect(word("hectare", 1.9)).toBe("hectare");
    // ...and the plural from two upwards, fractions included.
    expect(word("hectare", 2)).toBe("hectares");
    expect(word("hectare", 2.5)).toBe("hectares");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; French reuses `other`, which is also what French
    // grammar wants: "1 acre en hectares" names the target in the plural.
    expect(word("hectare", undefined, "conversion-target")).toBe("hectares");
    // The million, the row CLDR files under `many` and `french.selectForm`
    // folds into `other`: that category governs a compact *scale word* ("2
    // millions"), never the noun beside it.
    expect(word("hectare", 1e6)).toBe("hectares");
    // Feminine in French and masculine in nothing at all in English, which
    // changes the article and never the noun — so the same two rows.
    expect(word("acre", 1)).toBe("acre");
    expect(word("acre", 2)).toBe("acres");
  });

  test("an engine built from it reads and writes French area", () => {
    expect(engine.evaluate("2 hectares").formatted).toBe("2 hectares");
    expect(engine.evaluate("1 hectare").formatted).toBe("1 hectare");
    // `ha` is what a French land registry writes, and it reads back as the noun.
    expect(engine.evaluate("3 ha").formatted).toBe("3 hectares");
    // A conversion, written with `en` — French's own conversion keyword, which
    // happens to be spelled like English's — landing below two, so the noun is
    // *singular* where English would print "0.809… hectares".
    expect(engine.evaluate("2 acres en hectares").formatted).toBe(
      "0,80937128448 hectare",
    );
    // Arithmetic over a unit that has no words: `m²` is the whole of what this
    // unit reads and prints, in French as in every other language here.
    expect(engine.evaluate("1 m2 + 1 m2").formatted).toBe("2 m²");
    expect(engine.evaluate("1 m² + 0,5 m²").formatted).toBe("1,5 m²");
  });

  test("groups with U+202F, and reads its own grouped output back", () => {
    // The separator this runtime's CLDR data hands French, pinned by codepoint.
    // Ukrainian groups with U+00A0 and made the point that a whitespace
    // separator has to survive its own round trip; French adds that the
    // character is a *different* invisible space, so an implementation that had
    // hardcoded the non-breaking space would pass every Ukrainian test and lose
    // every French group.
    const grouped = engine.evaluate("2000 m2").formatted;
    expect(grouped).toBe(`2${NNBSP}000 m²`);
    // And the round trip that separator has to survive: `normalize()` folds
    // U+202F to a plain space before `lex` sees it, and `lex`'s three-digit
    // lookahead is what keeps "2 000 m²" one number instead of two.
    expect(engine.evaluate(grouped).value.canonical.toString()).toBe("2000");
    expect(engine.evaluate("2 000 m²").value.canonical.toString()).toBe("2000");
  });

  test("its own output reads back to the same value, grouping included", () => {
    for (const input of [
      "2 acres en hectares",
      "1 m2 + 1 m2",
      "1,5 hectare",
      "3 ha",
      "2000 m2",
      "0 hectare",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toString(), input).toBe(
        first.value.canonical.toString(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
