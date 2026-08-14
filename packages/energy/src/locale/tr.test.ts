import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { energy } from "../index";
import energyTr from "./tr";

const locale = () => composeLocale(turkish, [energyTr]);
const engine = createEngine({ locales: [locale()], kinds: [energy] });

/** Every key `turkish.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({
          count: new Decimal(count),
          kind: "energy",
          unit: "kj",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({ kind: "energy", unit: "kj", slot }),
      ),
    ),
);

describe("energy tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(energy.value.mode === "ratio" ? energy.value.units : {});
    expect(Object.keys(energyTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(energyTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex and
  // Turkish cannot borrow it: the kind is already full of Latin letters, and
  // every Turkish word this file adds is spelled in ASCII. So the word list is
  // the assertion, with the Turkish-only letters kept as a second net for
  // anything added later.
  test("the kind itself carries no Turkish word", () => {
    const descriptor = JSON.stringify(energy);
    expect(descriptor).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    for (const word of [
      "jul",
      "kilojul",
      "megajul",
      "vatsaat",
      "kilovatsaat",
      "megavatsaat",
      "kal",
      "kalori",
      "kilokalori",
    ]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });

  test("`turkish` asks for exactly one key, and eight units declare exactly it", () => {
    // The contract the language author pinned: `selectForm` returns "other" for
    // every count and every slot, because Turkish leaves a counted noun bare.
    // The sweep above includes the count-free call, which is what a conversion
    // target is (ruling R5), and it lands on the same single key.
    expect([...KEYS]).toEqual(["other"]);
    // Rule 6 in its strict form: the key set a unit declares is *exactly* the
    // set `selectForm` can produce. `btu` is the one exception, and it declares
    // no table at all rather than a table with a wrong key — the borrowed
    // initialism has no Turkish word to put in a row, and unlike Ukrainian this
    // language gains no spacing by filling one, because `turkish.renderQuantity`
    // already sets a bare symbol off with a space.
    for (const [unit, words] of Object.entries(energyTr.units)) {
      if (unit === "btu") {
        expect(words.forms, "btu declares a form").toBeUndefined();
        continue;
      }
      expect(Object.keys(words.forms ?? {}), `${unit}'s key set`).toEqual([...KEYS]);
    }
  });

  // The property `assertLocaleContract` does not check: it walks the alias list
  // and proves each alias resolves, and never asks whether the strings the
  // *printer* emits are among them. Two sources here — the word in `forms` and
  // the symbol under `symbols: true` — and both have to read back.
  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(energyTr.units)) {
      const printable = [words.symbol as string, ...Object.values(words.forms ?? {})];
      const aliases = words.aliases.map((a) => a.toLocaleLowerCase("tr"));
      for (const surface of printable) {
        expect(surface, `${unit}'s "${surface}" holds an operator character`).not.toMatch(
          /[/*+\-·×⋅]/,
        );
        expect(surface, `${unit}'s "${surface}" is more than one token`).not.toMatch(
          /\s/u,
        );
        expect(aliases, `${unit}: "${surface}" is printed but not readable`).toContain(
          surface.toLocaleLowerCase("tr"),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [energy])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Turkish folds every count onto the one key, which is
    // precisely the claim worth sampling rather than assuming: if `selectForm`
    // ever grows a second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [energy], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the watt-hour compound is one Turkish token, so it can be printed", () => {
    // The claim the vocabulary's doc comment makes, asserted rather than
    // trusted. English refuses a form here because "watt hour" is two words and
    // Ukrainian because "кіловат-година" is hyphenated; Turkish closes the
    // compound the way German closes "Kilowattstunde", so "kilovatsaat" is one
    // letter run and `parse/lex.ts` hands it over whole.
    expect(engine.evaluate("1 kwh").formatted).toBe("1 kilovatsaat");
    expect(engine.evaluate("1 kilovatsaat").value.unit).toBe("kwh");
    expect(engine.evaluate("2 vatsaat").value.unit).toBe("wh");
    expect(engine.evaluate("2 megavatsaat").value.unit).toBe("mwh");
  });

  test("an engine built from it reads and writes Turkish energy", () => {
    expect(engine.evaluate("5 jul").formatted).toBe("5 jul");
    expect(engine.evaluate("1,5 kilojul").formatted).toBe("1,5 kilojul");
    // Latin abbreviations still read: the aliases derive from the one map in
    // `units.ts` before the Turkish spellings are appended to it.
    expect(engine.evaluate("5 kcal").formatted).toBe("5 kilokalori");
    // A conversion, written with each of the three words the language lists
    // under `in`. The group separator is a full stop — the exact inverse of
    // English — so "1.000" is a thousand joules and not one of them.
    expect(engine.evaluate("1 kj çevir jul").formatted).toBe("1.000 jul");
    expect(engine.evaluate("1 kj cevir jul").formatted).toBe("1.000 jul");
    expect(engine.evaluate("1 kj to jul").formatted).toBe("1.000 jul");
    expect(engine.evaluate("1 kilovatsaat to megajul").formatted).toBe("3,6 megajul");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Turkish.
    expect(engine.evaluate("1 kj + 500 jul").formatted).toBe("1,5 kilojul");
    expect(engine.evaluate("1 kj artı 500 jul").formatted).toBe("1,5 kilojul");
    // The one unit with no `forms`, printing through its symbol — spaced,
    // because `turkish.renderQuantity` spaces a bare symbol where English sets
    // it tight.
    expect(engine.evaluate("12000 btu").formatted).toBe("12.000 BTU");
  });

  test("an all-caps unit word reads, which under Turkish rules it should not", () => {
    // The one thing about Turkish no other language in this repo has.
    // `"KALORI".toLocaleLowerCase("tr")` is "kalorı" with a DOTLESS ı — I and i
    // are separate letters here — and that matches no key in any alias index.
    // `turkish`'s `caseFolds` analyzer is what rescues it, offering the ASCII
    // reading at weight −1 beside the Turkish one at 0.
    expect("KALORI".toLocaleLowerCase("tr")).toBe("kalorı");
    expect(engine.evaluate("5 KALORI").value.unit).toBe("cal");
    // The spelling a Turkish reader would type in caps keeps the dot and takes
    // the unpenalised path to the same unit.
    expect("KALORİ".toLocaleLowerCase("tr")).toBe("kalori");
    expect(engine.evaluate("5 KALORİ").value.unit).toBe("cal");
  });

  test("vowel harmony is the language's job, and `minStem: 3` is why", () => {
    // Nothing below is an alias. Each is a case-marked Turkish word recovered by
    // `turkish`'s flat suffix stripper. This kind is where the stripper's floor
    // earns its keep exactly: "jul" is three letters, so "jule" strips back to a
    // stem the floor still admits, and a floor of 4 would have lost the
    // canonical unit of the kind. "kaloriye" needs the -y- buffer after a
    // vowel-final stem, and "kilovatsaatte" hardens the locative after the
    // voiceless t.
    for (const [surface, unit] of [
      ["jule", "j"],
      ["julden", "j"],
      ["kilojule", "kj"],
      ["kaloriye", "cal"],
      ["kaloride", "cal"],
      ["kilokaloriye", "kcal"],
      ["kilovatsaate", "kwh"],
      ["kilovatsaatte", "kwh"],
    ] as const) {
      expect(engine.evaluate(`5 ${surface}`).value.unit, surface).toBe(unit);
    }
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "5 jul",
      "1 kj + 500 jul",
      "1 kj to jul",
      "1,5 kilojul",
      "1 kilovatsaat to megajul",
      "12000 btu",
      "2000 kal",
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
