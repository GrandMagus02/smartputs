import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleFr from "./fr";

const fr = composeLocale(french, [angleFr]);
const engine = createEngine({ locales: [fr], kinds: [angle] });

/**
 * The two keys `french.selectForm` can return. Written out rather than derived
 * so that a language that grew a third category would fail *here*, on a list
 * somebody has to read, instead of silently leaving every table below a row
 * short — a live possibility for French rather than a hypothetical one:
 * `Intl.PluralRules("fr")` declares three categories and `fr.ts` folds the
 * third away on purpose.
 */
const KEYS = ["one", "other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = french.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "angle",
    unit,
    slot,
  });
  return (angleFr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

describe("angle fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no French word", () => {
    // French shares its script with the kind's own unit ids, so this cannot be
    // the Cyrillic-block test `uk` next door uses. Two checks instead: no French
    // orthography (the accented vowels and the cedilla, none of which an ASCII
    // unit id can contain), and none of the distinctly French nouns spelled
    // out. `radian` is deliberately absent from the second pattern — it is
    // `units.ts`'s own English alias, and finding it there would prove nothing
    // about French.
    expect(JSON.stringify(angle)).not.toMatch(/[àâäéèêëîïôöùûüÿç]/i);
    expect(JSON.stringify(angle)).not.toMatch(/degré|tours?\b|grades/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Rule 6: no more keys and no fewer. A third row would be a word no count
    // could ever select, and a missing row renders the unit's Latin key at a
    // reader without throwing.
    for (const [unit, words] of Object.entries(angleFr.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), unit).toEqual([...KEYS].sort());
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
            kind: "angle",
            unit: "deg",
            slot,
          }),
        );
      }
      seen.add(french.selectForm({ kind: "angle", unit: "deg", slot }));
    }
    expect([...seen].sort()).toEqual([...KEYS].sort());
  });

  test("every form it prints is a form it reads", () => {
    // The gap `assertLocaleContract` closes globally, asserted here on the
    // vocabulary alone: a printed plural only the penalised suffix stripper can
    // recover is a word this file guessed rather than declared. `degré` is what
    // makes this more than a formality — the acute is on both numbers, and no
    // suffix rule reaches an accented string from an unaccented one.
    for (const [unit, words] of Object.entries(angleFr.units)) {
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
    for (const [unit, words] of Object.entries(angleFr.units)) {
      for (const alias of words.aliases) {
        expect(
          seen.get(alias),
          `${alias} claimed by ${seen.get(alias)} too`,
        ).toBeUndefined();
        seen.set(alias, unit);
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(fr, [angle])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so without this sweep the fractional
    // category is never reached at all. For French that is the category the
    // whole language differs from English on: 1,5 selects `one`, not `other`,
    // and a table that had copied English's two columns would still pass every
    // integer row above.
    assertLocaleContract(fr, [angle], {
      counts: [0, 1, 1.5, 1.9, 2, 5, 11, 21, 100, 1000],
    });
  });

  test("singular below two, plural from two — the French boundary", () => {
    expect(word("deg", 1)).toBe("degré");
    // The two rows English gets wrong. French writes the singular on zero and
    // on every fraction under two.
    expect(word("deg", 0)).toBe("degré");
    expect(word("deg", 1.5)).toBe("degré");
    expect(word("deg", 1.9)).toBe("degré");
    // ...and the plural from two upwards, fractions included.
    expect(word("deg", 2)).toBe("degrés");
    expect(word("deg", 2.5)).toBe("degrés");
    // The count-free conversion target — ruling R5. Ukrainian needs a row of
    // its own for this; French reuses `other`, which is also what French
    // grammar wants: "1 tour en degrés" names the target in the plural.
    expect(word("deg", undefined, "conversion-target")).toBe("degrés");
    // The million, the row CLDR files under `many` and `french.selectForm`
    // folds into `other`: that category governs a compact *scale word* ("2
    // millions"), never the noun beside it.
    expect(word("deg", 1e6)).toBe("degrés");
    expect(word("grad", 1)).toBe("grade");
    expect(word("grad", 2)).toBe("grades");
    expect(word("turn", 1)).toBe("tour");
    expect(word("turn", 2)).toBe("tours");
  });

  test("the turn is read by both its names and printed by one", () => {
    // `tour` is what a person says and `révolution` what a datasheet says. Both
    // read; the printer has to pick one, and it picks the everyday word.
    expect(engine.evaluate("3 révolutions").formatted).toBe("3 tours");
    expect(engine.evaluate("3 tours").formatted).toBe("3 tours");
    // `rev` and `revolutions` ride in from `units.ts` — the second is the same
    // word French spells with an acute, so the borrowing supplies the
    // accent-free twin at no cost here.
    expect(engine.evaluate("3 rev").formatted).toBe("3 tours");
    expect(engine.evaluate("3 revolutions").formatted).toBe("3 tours");
  });

  test("an engine built from it reads and writes French angle", () => {
    expect(engine.evaluate("2 degrés").formatted).toBe("2 degrés");
    expect(engine.evaluate("1 degré").formatted).toBe("1 degré");
    // The accent-free spelling, declared by hand because NFKC leaves a
    // precomposed `é` alone and nothing else in the index carries it.
    expect(engine.evaluate("180 degres").formatted).toBe("180 degrés");
    // A conversion, written with `en` — French's own conversion keyword, which
    // happens to be spelled like English's.
    expect(engine.evaluate("1 tour en degrés").formatted).toBe("360 degrés");
    // Arithmetic landing on a fraction: the decimal comma comes from CLDR
    // through `numberFormat: "intl"`, and the noun is *singular* because
    // 1,5 < 2, where English would print "1.5 degrees".
    expect(engine.evaluate("1 degré + 0,5 degré").formatted).toBe("1,5 degré");
    // `gon` is the international name French itself uses; `grade` is the French
    // noun, and it is what gets printed.
    expect(engine.evaluate("1 gon").formatted).toBe("1 grade");
    expect(engine.evaluate("2 grades").formatted).toBe("2 grades");
    // Borrowed into English unchanged, so this word needed no French entry.
    expect(engine.evaluate("2 radians").formatted).toBe("2 radians");
  });

  test("`°` is declared as an alias, and `lex` cannot hand it back yet", () => {
    // The degree sign is the only written short form for an angular degree in
    // any Latin-script language, so it is the honest `symbol` (`uk` and `es`
    // make the same call). It is a declared alias, so `assertLocaleContract` —
    // which consults the alias index — finds it readable, and the day `lex`
    // learns the sign it resolves with no change here.
    //
    // Today it does not: `normalize()` deletes "°" outright (it is `EditReason`
    // "degree"), so "90°" arrives at `lex` as a bare number. That is a decision
    // in core's normalizer rather than a gap in this vocabulary, so it is pinned
    // here instead of being avoided — and it is why a `symbols: true` print is
    // kept out of the round-trip loop below.
    expect(angleFr.units.deg?.aliases).toContain("°");
    expect(engine.evaluate("90°").value.kind).toBe("number");
  });

  test("groups with U+202F, and reads its own grouped output back", () => {
    // The separator this runtime's CLDR data hands French, pinned by codepoint.
    // Ukrainian groups with U+00A0 and made the point that a whitespace
    // separator has to survive its own round trip; French adds that the
    // character is a *different* invisible space, so an implementation that had
    // hardcoded the non-breaking space would pass every Ukrainian test and lose
    // every French group.
    const grouped = engine.evaluate("2000 degrés").formatted;
    expect(grouped).toBe(`2${NNBSP}000 degrés`);
    // And the round trip that separator has to survive: `normalize()` folds
    // U+202F to a plain space before `lex` sees it, and `lex`'s three-digit
    // lookahead is what keeps "2 000 degrés" one number instead of two.
    expect(engine.evaluate(grouped).value.canonical.toString()).toBe(
      engine.evaluate("2000 degrés").value.canonical.toString(),
    );
    expect(engine.evaluate("2 000 degrés").value.unit).toBe("deg");
  });

  test("its own output reads back to the same value, grouping included", () => {
    for (const input of [
      "1 tour en degrés",
      // "1 degré + 0,5 degré" is deliberately not in this loop: the degree
      // ratio is a 30-digit literal, so a sum carried through it and formatted
      // back at the engine's 26 significant digits differs from the same
      // magnitude read in directly by one unit in the last place. That is
      // rounding, not a vocabulary fault, and the sum's printed form is asserted
      // exactly in the block above instead.
      "1,5 degré",
      "2 radians",
      "1 gon",
      "180 degrés",
      "2000 degrés",
      "0 degré",
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
