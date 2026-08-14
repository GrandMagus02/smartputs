import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperatureTr from "./tr";

const [readingTr, deltaTr] = temperatureTr;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(turkish, temperatureTr);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/**
 * The Turkish words this file argues about, grepped for by name. A script regex
 * would catch almost nothing here: Turkish is written in Latin letters, so it
 * looks like a unit key to any character class — `nl.test.ts` could still reach
 * for its tremas and this file cannot. The diacritic-free spellings are listed
 * beside the correct ones because that is how a word would arrive from an ASCII
 * keyboard.
 */
const TURKISH = /santigrat|santigrad|derece|sıcaklık|sicaklik|fahrenhayt/i;

/** The closed key set `turkish.selectForm` can produce. `en` has two, `uk` eight. */
const ONE_KEY = ["other"];

/**
 * Every word this vocabulary adds on top of the generated table, by unit.
 *
 * Derived by subtracting `en`'s list rather than by matching a script — the only
 * route available in a shared alphabet, and the same one `id.test.ts` and
 * `de.test.ts` take.
 */
const added = (unit: string): string[] => {
  const generated = new Set(readingEn?.units[unit]?.aliases ?? []);
  return (readingTr?.units[unit]?.aliases ?? []).filter((a) => !generated.has(a));
};

describe("temperature tr vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureTr.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureTr) expect(vocabulary.locale).toBe("tr");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingTr?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaTr?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureTr) {
      for (const [unit, words] of Object.entries(vocabulary.units)) {
        expect(
          words.aliases.length,
          `${vocabulary.kind}:${unit} has no aliases`,
        ).toBeGreaterThan(0);
        expect(words.symbol, `${vocabulary.kind}:${unit} has no symbol`).toBeDefined();
      }
    }
  });

  // Same reason as `en.test.ts`'s copy of this test: the two kinds answer to the
  // same words on purpose — that is what lets "20 C + 5 F" read its right operand
  // as a difference — and it is also what makes every temperature alias
  // ambiguous, which `print/unit-word.ts`'s ambiguity fallback is written
  // against. Two lists that drifted apart would silently disarm it, which is why
  // the Turkish half is applied to both kinds from one table rather than typed
  // twice.
  test("both kinds register the identical alias list", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaTr?.units[unit]?.aliases).toEqual(
        readingTr?.units[unit]?.aliases ?? [],
      );
    }
    for (const unit of ["c", "f", "k"]) {
      // The generated half is reused from the one `ALIAS` map in `units.ts`
      // rather than retyped, so a Turkish engine still reads "212 F".
      for (const generated of readingEn?.units[unit]?.aliases ?? []) {
        expect(readingTr?.units[unit]?.aliases, generated).toContain(generated);
      }
      expect(deltaTr?.units[unit]?.aliases, unit).toEqual(
        readingTr?.units[unit]?.aliases ?? [],
      );
    }
  });

  // What Turkish adds, and to which unit. Two words on `c` and nothing anywhere
  // else — the three scale names are eponyms and Turkish orthography leaves a
  // person's name alone, so *Celsius*, *Fahrenheit* and *kelvin* are already
  // spelled the way the table has them.
  test("adds two words, both to celsius, and none to f or k", () => {
    expect(added("c")).toEqual(["santigrat", "santigrada"]);
    expect(added("f")).toEqual([]);
    expect(added("k")).toEqual([]);
    const e = engine();
    expect(e.evaluate("20 santigrat").value?.unit).toBe("c");
    expect(e.evaluate("20 santigrat").formatted).toBe("20 °C");
    // *Santigrat* is the common noun *centigrade*, which the respelling machinery
    // does touch — c → s before a front vowel, the final consonant devoiced — and
    // the table's own "centigrade" is the word it corresponds to.
    expect(readingTr?.units.c?.aliases).toContain("centigrade");
    // Capitalised as Turkish sets a heading, and in the ASCII caps a keyboard
    // without a dotted İ produces. The second only reads because
    // `@smartput/core/locale/tr` folds `I` twice — once to "ı" as a Turkish reader
    // means it, once to "i" as the keyboard meant it — and it is the row that
    // fails the moment anything in the chain starts folding under a `tr` tag.
    expect(e.evaluate("20 SANTİGRAT").value?.unit).toBe("c");
    expect(e.evaluate("20 SANTIGRAT").value?.unit).toBe("c");
  });

  // The second word is a case form, and the reason it has to be listed is the one
  // thing about Turkish morphology a flat suffix list structurally cannot do.
  // Harmony can be enumerated: the locative and the ablative strip clean, because
  // the ending changes and the stem does not. The dative voices the stem's final
  // `t` to `d`, so there is no suffix to remove that leaves *santigrat* behind.
  test("the locative strips and the dative cannot, so the dative is listed", () => {
    const e = engine();
    // Reached through `@smartput/core/locale/tr`'s suffix list, not through this
    // vocabulary: neither of these is an alias.
    expect(readingTr?.units.c?.aliases).not.toContain("santigratta");
    expect(e.evaluate("20 santigratta").value?.unit).toBe("c");
    expect(e.evaluate("20 santigrattan").value?.unit).toBe("c");
    // Reached only because it is listed, and worth listing because the dative is
    // the case a Turkish conversion target stands in.
    expect(readingTr?.units.c?.aliases).toContain("santigrada");
    expect(e.evaluate("300 K çevir santigrada").formatted).toBe("26,85 °C");
    // The residue of the same softening, measured rather than assumed. The
    // accusative is one substitution from the listed dative, so the resolver
    // corrects it; the genitive is two and is refused with a suggestion.
    expect(e.evaluate("20 santigradı").value?.unit).toBe("c");
    expect(e.explain("20 santigradı").candidates[0]?.fuzzy?.alias).toBe("santigrada");
    expect(() => e.evaluate("20 santigradın")).toThrow(/santigrada/);
  });

  // The word that would have earned a line and cannot: *derece* is Turkish for
  // "degree" and the scale name never stands beside it as one token. Recorded as
  // live assertions rather than left in the doc comment, following `nl.test.ts`'s
  // "graad" precedent: an unclaimed word that reads as coverage is worse than a
  // gap that is written down.
  test("derece is a phrase, and the bare word belongs to angle", () => {
    const aliases = readingTr?.units.c?.aliases ?? [];
    expect(aliases).not.toContain("derece");
    expect(aliases.some((a) => a.includes("derece"))).toBe(false);
    // Both Turkish orders are phrases. The second is the sharper one, because the
    // head carries a possessive suffix in it — *derecesi*, not *derece* — so even
    // a compound splitter of the kind `de` uses would have to undo agglutination
    // before it found a word to look up.
    expect(() => engine().evaluate("20 santigrat derece")).toThrow();
    expect(() => engine().evaluate("20 Celsius derecesi")).toThrow();
    // And the bare word is left unclaimed rather than handed to whichever package
    // was written first: "45 derece" is a slope at least as often as a
    // temperature, and no context either kind could offer separates them.
    expect(() => engine().evaluate("20 derece")).toThrow();
  });

  // *Fahrenhayt* turns up in Turkish writing, and it is one person transcribing a
  // surname rather than a form the language has taken in — TDK keeps
  // *Fahrenheit*, because an eponym is exactly what Turkish orthography does not
  // respell. Pinned as a *suggestion* rather than a reading, so that the day the
  // correction budget widens, this decision comes back on a failing test.
  test("fahrenhayt is suggested, not read", () => {
    expect(readingTr?.units.f?.aliases).not.toContain("fahrenhayt");
    expect(() => engine().evaluate("100 fahrenhayt")).toThrow(/fahrenheit/);
    expect(engine().evaluate("100 fahrenheit").value?.unit).toBe("f");
  });

  // The per-unit decision is `en`'s, not re-taken here: the written form of this
  // unit is the symbol, and the spelled phrase is a phrase in this language as
  // much as in English. Asserting it against `en` rather than against `undefined`
  // is what makes the mirror the thing under test — if a later phase gives an
  // English temperature unit words, this fails until Turkish follows.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [tr, en] of [
      [readingTr, readingEn],
      [deltaTr, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(tr?.units[unit]?.forms, `${tr?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(tr?.units[unit]?.forms, `${tr?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  // The mirror of `en.test.ts`'s "the kinds themselves carry no English word": a
  // kind is ratios, offsets and unit ids, so no Turkish word may reach it. A
  // script regex is useless in a shared alphabet, so this greps for the words.
  test("the kinds themselves carry no Turkish word", () => {
    for (const kind of [temperature, tempdelta]) {
      expect(JSON.stringify(kind)).not.toMatch(TURKISH);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they never reach a fractional
    // reading at all. Under `tr` a fraction cannot select a different key — there
    // is only one — and here it can only confirm the absence of a `forms` table
    // besides, since a unit with none is skipped before any key is asked for.
    // That is the honest shape of this kind's coverage, and running the same call
    // every sibling row runs keeps it comparable.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Turkish temperature", () => {
    const e = engine();
    // The plural boundary, and the point of a symbol-only kind: the output does
    // *not* move across it. Under `en` that is two keys collapsing to one printed
    // string; under `tr` there is only ever one key, so the row is doubly empty.
    expect(e.evaluate("1 kelvin").formatted).toBe("1 K");
    expect(e.evaluate("2 kelvin").formatted).toBe("2 K");
    // The fractional row, with Turkish's decimal comma — from CLDR, through
    // `numberFormat: "intl"`.
    expect(e.evaluate("1,5 kelvin").formatted).toBe("1,5 K");
    // A conversion, read with each of Turkish's conversion keywords and printed
    // in the target scale. Both operands' words come from the shared table; the
    // offsets come from the kind.
    expect(e.evaluate("300 K çevir celsius").formatted).toBe("26,85 °C");
    expect(e.evaluate("300 K cevir santigrat").formatted).toBe("26,85 °C");
    expect(e.evaluate("212 F to C").formatted).toBe("100 °C");
    // A conversion whose result groups. Turkish groups with "." — which, unlike
    // Ukrainian's U+00A0, survives `normalize()`, so this row is round-tripped
    // below rather than merely asserted as a string.
    expect(e.evaluate("5000 C çevir F").formatted).toBe("9.032 °F");
    // The delta kind, reached through the same words and through this language's
    // word for subtraction: a difference between two readings is 10 degrees, not
    // a reading of 10 degrees.
    const diff = e.evaluate("30 celsius eksi 20 celsius");
    expect(diff.formatted).toBe("10 °C");
    expect(diff.value?.kind).toBe("tempdelta");
    // A sum that lands on a fraction, through this language's word for addition.
    expect(e.evaluate("1 kelvin artı 0,5 kelvin").formatted).toBe("1,5 K");
  });

  // The one thing Turkish changes about how a temperature is *written*, and it
  // comes from the language rather than from this file: `@smartput/core/locale/tr`
  // declares a `renderQuantity` that spaces a bare symbol, because TSE follows SI
  // and writes "20 °C". This package is the one place that override is visible
  // for this language — with no `forms` on any unit, the default template's tight
  // branch is exactly the branch these units take.
  test("the symbol is spaced, which is TSE and not English's tight 20°C", () => {
    expect(turkish.renderQuantity).toBeDefined();
    expect(engine().evaluate("20 C").formatted).toBe("20 °C");
    expect(engine().evaluate("20 C").formatted).not.toBe("20°C");
    // And it survives the trip back, which is the only reason it is safe to
    // print: `lex` skips "°" as an unrecognized character, so the reader sees the
    // number and then the bare "C" this table already claims.
    expect(engine().evaluate("20 °C").value?.canonical.toString()).toBe("20");
  });

  // `turkish.selectForm` still answers for these units — it is a constant and
  // knows nothing about which units have tables — so the reason no grammar is
  // exercised here is the missing `forms`, not a missing key. Pinning that keeps
  // the previous tests honest: they assert output does not move across the plural
  // boundary, and this says why.
  test("selectForm produces one key this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      turkish.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "temperature",
        unit: "c",
        slot,
      });
    expect(
      [
        ...new Set([
          ...[1, 2, 5, 1.5].flatMap((c) => [
            key(c, "after-number"),
            key(c, "conversion-target"),
          ]),
          key(undefined, "conversion-target"),
        ]),
      ].sort(),
    ).toEqual(ONE_KEY);
    // Turkish reaches the one-key table *against* CLDR rather than with it, which
    // is what distinguishes it from `id`, `ja` and `zh`: a counted noun here is
    // bare whatever the count, so the second declared category would only ever
    // hold a duplicate string.
    expect(new Intl.PluralRules("tr").resolvedOptions().pluralCategories.sort()).toEqual([
      "one",
      "other",
    ]);
    expect(key(1, "after-number")).toBe("other");
    expect(readingTr?.units.c?.forms).toBeUndefined();
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped row is in this list where the Ukrainian file had to leave it
    // out: Turkish groups with "." and `normalize()`'s NFKC pass leaves that
    // alone, so "9.032 °F" reads back as one quantity — as does the decimal
    // comma, an ordinary ASCII character here and not Ukrainian's NBSP.
    for (const input of [
      "20 santigrat",
      "1,5 kelvin",
      "100 fahrenheit",
      "300 K çevir celsius",
      "5000 C çevir F",
      "30 celsius eksi 20 celsius",
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
