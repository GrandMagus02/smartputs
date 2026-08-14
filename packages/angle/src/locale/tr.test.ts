import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { angle } from "../index";
import angleTr from "./tr";

const engine = () =>
  createEngine({
    locales: [composeLocale(turkish, [angleTr])],
    kinds: [angle],
  });

/** The only key `turkish.selectForm` can produce. */
const KEYS = ["other"];

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = turkish.selectForm({
    // Spread rather than `count: undefined`: `exactOptionalPropertyTypes` makes
    // "absent" and "present but undefined" different types, and ruling R5's
    // count-free row is the absent one.
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "angle",
    unit,
    slot,
  });
  return (angleTr.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("angle tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(angle.value.mode === "ratio" ? angle.value.units : {});
    expect(Object.keys(angleTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(angleTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the kind itself carries no Turkish word", () => {
    // Two sweeps, because neither alone is enough for a language written in a
    // Latin alphabet. The first is the script check the Cyrillic and CJK files
    // do, narrowed to the six letters Turkish added to the Latin alphabet. The
    // second names the Turkish words that are pure ASCII and so invisible to the
    // first, each bounded so an English alias cannot match it: `\btur\b` cannot
    // be reached inside `turn` or `turns`, and neither `radyan` nor `derece`
    // appears anywhere near `radian` or `degree`. The degree sign is swept for
    // too, because this vocabulary is the only place it is introduced.
    expect(JSON.stringify(angle)).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    expect(JSON.stringify(angle)).not.toMatch(/radyan|derece|\bdevir\b|\btur\b|°/i);
  });

  test("every unit carries exactly the key set selectForm can produce", () => {
    // Derived rather than trusted: sweeping every slot against a spread of
    // counts is what shows one key is all `turkish.selectForm` can ever ask for,
    // which is what makes the exact-match assertion on each table mean something
    // (rule 6). The counts deliberately include the shapes that move every other
    // language here — 1, the 2/5/11/21 Slavic boundaries, a fraction, and zero —
    // and none of them moves Turkish. This is the kind where that is loudest:
    // Dutch and German both mark number here, on the reasoning that an angle is
    // counted where a length is measured out, and Turkish has no number axis for
    // the distinction to land on.
    const produced = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"]) {
      for (const count of [undefined, 0, 1, 1.5, 2, 5, 11, 21, 100, 1000]) {
        produced.add(
          turkish.selectForm({
            ...(count === undefined ? {} : { count: new Decimal(count) }),
            kind: "angle",
            unit: "deg",
            slot,
          }),
        );
      }
    }
    expect([...produced].sort()).toEqual(KEYS);

    for (const [unit, words] of Object.entries(angleTr.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(KEYS);
    }
  });

  test("every form it prints is a form it reads", () => {
    // Compared verbatim, with none of the folding `de.test.ts` needs: Turkish
    // capitalises no common noun, so the string this table prints is the string
    // `buildRegistry` indexes. That is a decision and not an accident — the
    // registry folds an alias key with `toLocaleLowerCase("tr")`, under which a
    // capital `I` becomes `ı` rather than `i`, so a capital in this table would
    // be indexed under a different letter than the reader typed.
    //
    // The symbol half of the check is what forces `°` into `aliases`: it is the
    // one string here `units.ts` does not declare, and the suffix stripper
    // cannot manufacture a punctuation mark at any penalty.
    for (const [unit, words] of Object.entries(angleTr.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        expect(
          words.aliases,
          `${unit} prints ${key}="${form}" but does not list it`,
        ).toContain(form);
      }
      expect(words.aliases, `${unit} prints symbol ${words.symbol}`).toContain(
        words.symbol as string,
      );
    }
  });

  test("the gradian keeps `grad`, which German had to give up", () => {
    // `@smartput/angle/locale/de` spends its header on the reservation: the
    // German word for an angular degree *is* `Grad`, the string `units.ts`
    // declares as the abbreviation for the gradian, so one of the two units had
    // to yield. The Turkish word is `derece`, which collides with nothing, so
    // both units keep everything the alias map gave them.
    expect(angleTr.units.grad?.aliases).toContain("grad");
    expect(angleTr.units.deg?.aliases).toContain("derece");
    const e = engine();
    expect(e.evaluate("100 grad").value.unit).toBe("grad");
    expect(e.evaluate("100 gon").value.unit).toBe("grad");
    expect(e.evaluate("90 derece").value.unit).toBe("deg");
  });

  test("`gradyan` is the Turkish word for a gradient, and is left out", () => {
    // It looks like the obvious Turkish spelling of *gradian* and is already
    // taken: `gradyan` is the vector-calculus operator and the slope of a road.
    // Claiming it would put an angle reading in front of a word Turkish uses for
    // something else, in a kind with no way to tell the two apart.
    for (const words of Object.values(angleTr.units)) {
      expect(words.aliases).not.toContain("gradyan");
    }
    const reading = engine().evaluate("100 gradyan");
    expect(reading.value.unit).not.toBe("grad");

    // What leaving it out actually costs, measured rather than assumed. The word
    // is not *refused*: it is one edit away from `radyan`, so the fuzzy
    // corrector reaches the radian and answers "100 radyan". That is a
    // correction the engine can explain and rank, where an alias would have been
    // a silent claim on the word — and the alternative was not silence either,
    // since claiming `gradyan` for this unit would answer an angle to every
    // Turkish sentence about a slope. Pinned because it is the kind of thing a
    // fuzzy-weight change should have to look at.
    expect(reading.value.unit).toBe("rad");
  });

  test("satisfies the locale contract, fractional counts included", () => {
    expect(() =>
      assertLocaleContract(composeLocale(turkish, [angleTr]), [angle]),
    ).not.toThrow();
    // The default counts are all integers, so a language whose `selectForm` read
    // `count` at all would never be asked for its fractional category. 1.5 is
    // what makes the contract sample it — and in Turkish that row is the same
    // word as every other row, where Dutch's is a plural (`graden`) because an
    // angle is counted.
    expect(() =>
      assertLocaleContract(composeLocale(turkish, [angleTr]), [angle], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("nothing moves the noun, on any axis", () => {
    for (const unit of ["rad", "deg", "grad", "turn"]) {
      expect(word(unit, 1), unit).toBe(word(unit, 2) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 1.5) as string);
      expect(word(unit, 1), unit).toBe(word(unit, 0) as string);
      // Ruling R5's count-free row, in the slot German sends to the dative and
      // Turkish deliberately does not — see the vocabulary's header.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(
        word(unit, 1) as string,
      );
    }
    expect(word("deg", 90)).toBe("derece");
    expect(word("rad", 1)).toBe("radyan");
    expect(word("turn", 2)).toBe("devir");
  });

  test("an engine built from it reads and writes Turkish angle", () => {
    const e = engine();
    expect(e.evaluate("90 derece").formatted).toBe("90 derece");
    expect(e.evaluate("1 radyan").formatted).toBe("1 radyan");
    expect(e.evaluate("100 grad").formatted).toBe("100 grad");
    // The everyday word for a rotation reads; the technical one is printed.
    expect(e.evaluate("2 tur").formatted).toBe("2 devir");
    // The English `turn`/`turns` from `units.ts` read, and answer in Turkish.
    expect(e.evaluate("2 turn").formatted).toBe("2 devir");
    // Arithmetic, and a conversion in both directions through both spellings of
    // the verb plus English's `to`.
    expect(e.evaluate("90 derece artı 45 derece").formatted).toBe("135 derece");
    expect(e.evaluate("1 devir çevir derece").formatted).toBe("360 derece");
    expect(e.evaluate("1 devir cevir derece").formatted).toBe("360 derece");
    expect(e.evaluate("1 devir to derece").formatted).toBe("360 derece");
    // A conversion landing on a fraction, with the decimal comma CLDR supplies.
    expect(e.evaluate("180 derece çevir devir").formatted).toBe("0,5 devir");
    expect(e.evaluate("90 derece bölü 4").formatted).toBe("22,5 derece");
  });

  test("agglutination reaches these nouns without a word for every ending", () => {
    // Vowel harmony: `derece` ends in a front vowel and takes `-ye`/`-den`,
    // `radyan` ends in a back one and takes `-a`/`-dan`.
    // `@smartput/core/locale/tr` enumerates every variant because a flat
    // stripper cannot express the rule.
    const e = engine();
    expect(e.evaluate("90 dereceye").formatted).toBe("90 derece");
    expect(e.evaluate("90 dereceden").formatted).toBe("90 derece");
    expect(e.evaluate("1 radyana").formatted).toBe("1 radyan");
    expect(e.evaluate("2 turdan").formatted).toBe("2 devir");
    expect(e.evaluate("90 dereceler").formatted).toBe("90 derece");
  });

  test("the dotted and dotless i, from both keyboards", () => {
    // `"DEVIR"` lowercases to `"devır"` under Turkish rules and to `"devir"`
    // under everything else, so the language offers both readings — the Turkish
    // one at weight 0 and the ASCII keyboard's at −1 — and this vocabulary is
    // spelled entirely in lowercase so that neither fold can miss it.
    const e = engine();
    expect(e.evaluate("2 DEVİR").formatted).toBe("2 devir");
    expect(e.evaluate("2 DEVIR").formatted).toBe("2 devir");
    expect(e.evaluate("2 Devir").formatted).toBe("2 devir");
    expect(e.evaluate("90 DERECE").formatted).toBe("90 derece");
    for (const words of Object.values(angleTr.units)) {
      for (const alias of words.aliases) {
        expect(alias, `${alias} is not lowercase`).toBe(alias.toLowerCase());
      }
    }
  });

  test("its own output reads back to the same value", () => {
    const e = engine();
    for (const input of [
      "90 derece artı 45 derece",
      "1 devir çevir derece",
      "180 derece çevir devir",
      "100 grad",
      "1 radyan",
      "2 turn",
      "90 derece bölü 4",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value.unit, input).toBe(first.value.unit);
      // Compared at 20 decimals rather than digit for digit, exactly as
      // `nl.test.ts` and `id.test.ts` compare them: this kind's canonical is
      // radians and its ratios are 30-digit literals, so re-reading a printed
      // degree count rounds in the last of the 28 configured digits. That is the
      // kind's arithmetic and not the language's — the mass, length, area and
      // volume round trips beside this one are exact.
      expect(again.value.canonical.toFixed(20), input).toBe(
        first.value.canonical.toFixed(20),
      );
    }
  });
});
