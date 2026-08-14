import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { turkish } from "@smartput/core/locale/tr";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationTr from "./tr";

const locale = () => composeLocale(turkish, [durationTr]);
const engine = createEngine({ locales: [locale()], kinds: [duration] });

/** Every key `turkish.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({
          count: new Decimal(count),
          kind: "duration",
          unit: "h",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        turkish.selectForm({ kind: "duration", unit: "h", slot }),
      ),
    ),
);

describe("duration tr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationTr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationTr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex and
  // Turkish cannot borrow it: the kind is already full of Latin letters. What
  // Turkish has instead is an alphabet with six letters no English word carries
  // — ç ğ ı ö ş ü and the dotted capital İ, which "gün" alone would trip — plus
  // the word list, for the spellings that are pure ASCII.
  test("the kind itself carries no Turkish word", () => {
    const descriptor = JSON.stringify(duration);
    expect(descriptor).not.toMatch(/[çğıöşüÇĞİÖŞÜ]/u);
    for (const word of [
      "milisaniye",
      "saniye",
      "dakika",
      "saat",
      "gun",
      "hafta",
      "sn",
      "dk",
      "sa",
    ]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}\\b`, "i"),
      );
    }
  });

  test("`turkish` asks for exactly one key, and every unit declares exactly it", () => {
    // The contract the language author pinned: `selectForm` returns "other" for
    // every count and every slot, because Turkish leaves a counted noun bare.
    // The sweep above includes the count-free call, which is what a conversion
    // target is (ruling R5), and it lands on the same single key.
    expect([...KEYS]).toEqual(["other"]);
    // Rule 6 in its strict form: exactly the set `selectForm` can produce, no
    // missing row that would silently print a symbol where a word belongs and no
    // extra row no count can reach. This is the kind where a translator's
    // instinct to add a plural row is strongest — these are the six nouns prose
    // pluralises most — and this line is what refuses it.
    for (const [unit, words] of Object.entries(durationTr.units)) {
      expect(Object.keys(words.forms ?? {}), `${unit}'s key set`).toEqual([...KEYS]);
    }
  });

  // The property `assertLocaleContract` does not check: it walks the alias list
  // and proves each alias resolves, and never asks whether the strings the
  // *printer* emits are among them. Two sources here — the word in `forms` and
  // the symbol under `symbols: true` — and both have to read back.
  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(durationTr.units)) {
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
    expect(() => assertLocaleContract(locale(), [duration])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. Turkish folds every count onto the one key, which is
    // precisely the claim worth sampling rather than assuming: if `selectForm`
    // ever grows a second row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [duration], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the counted noun never changes shape", () => {
    // "5 saatler" is not a plural, it is a mistake, and this is the line that
    // says so in output. English would need two rows here and Ukrainian four.
    expect(engine.evaluate("1 saat").formatted).toBe("1 saat");
    expect(engine.evaluate("5 saat").formatted).toBe("5 saat");
    expect(engine.evaluate("1,5 saat").formatted).toBe("1,5 saat");
    expect(engine.evaluate("21 saat").formatted).toBe("21 saat");
  });

  test("an engine built from it reads and writes Turkish duration", () => {
    expect(engine.evaluate("5 saat").formatted).toBe("5 saat");
    expect(engine.evaluate("2 gün").formatted).toBe("2 gün");
    // The diacritic-free spelling an ASCII keyboard produces reads, and prints
    // back with its ü. The language's case folds cover the dotted and dotless i
    // and nothing else, so ü → u had to be a vocabulary's alias.
    expect(engine.evaluate("2 gun").formatted).toBe("2 gün");
    // Latin abbreviations still read: the aliases derive from the one map in
    // `units.ts` before the Turkish spellings are appended to it.
    expect(engine.evaluate("2 h").formatted).toBe("2 saat");
    // A conversion, written with each of the three words the language lists
    // under `in`.
    expect(engine.evaluate("1 saat çevir dakika").formatted).toBe("60 dakika");
    expect(engine.evaluate("1 saat cevir dakika").formatted).toBe("60 dakika");
    expect(engine.evaluate("1 saat to dakika").formatted).toBe("60 dakika");
    expect(engine.evaluate("1 hafta to gün").formatted).toBe("7 gün");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Spelled with a comma on purpose: "1.5" is fifteen hundred in Turkish.
    expect(engine.evaluate("1 dakika + 30 saniye").formatted).toBe("1,5 dakika");
    expect(engine.evaluate("1 dakika artı 30 saniye").formatted).toBe("1,5 dakika");
    // And the group separator, which is a full stop — the exact inverse of
    // English — so "2.000" is two thousand seconds and not two of them.
    expect(engine.evaluate("2000 saniye").formatted).toBe("2.000 saniye");
  });

  test("an all-caps unit word reads, which under Turkish rules it should not", () => {
    // The one thing about Turkish no other language in this repo has.
    // `"SANIYE".toLocaleLowerCase("tr")` is "sanıye" with a DOTLESS ı — I and i
    // are separate letters here — and that matches no key in any alias index.
    // `turkish`'s `caseFolds` analyzer is what rescues it, offering the ASCII
    // reading at weight −1 beside the Turkish one at 0.
    expect("SANIYE".toLocaleLowerCase("tr")).toBe("sanıye");
    expect(engine.evaluate("5 SANIYE").value.unit).toBe("s");
    // The spelling a Turkish reader would actually type in caps keeps the dot on
    // the İ and takes the unpenalised path to the same unit.
    expect("SANİYE".toLocaleLowerCase("tr")).toBe("saniye");
    expect(engine.evaluate("5 SANİYE").value.unit).toBe("s");
    // And a word with no i-shaped letter never meets the question at all.
    expect(engine.evaluate("5 GÜN").value.unit).toBe("d");
  });

  test("vowel harmony is the language's job, not this table's", () => {
    // Nothing below is an alias. Each is a case-marked Turkish word recovered by
    // `turkish`'s flat suffix stripper, which enumerates every harmonic variant
    // because a flat list cannot express the rule. This kind draws on both
    // halves of the rule at once: "saate" takes the back-vowel dative and "güne"
    // the front-vowel one, "saatte" hardens the locative after a voiceless t
    // where "günde" does not, and "dakikaya" and "saniyeye" both need the -y-
    // buffer after a vowel-final stem.
    for (const [surface, unit] of [
      ["saate", "h"],
      ["saatte", "h"],
      ["saatten", "h"],
      ["güne", "d"],
      ["günde", "d"],
      ["günler", "d"],
      ["dakikaya", "min"],
      ["dakikada", "min"],
      ["saniyeye", "s"],
      ["saniyede", "s"],
      ["haftaya", "wk"],
      ["haftada", "wk"],
      ["milisaniyede", "ms"],
    ] as const) {
      expect(engine.evaluate(`5 ${surface}`).value.unit, surface).toBe(unit);
    }
  });

  test("`minStem: 3` is what keeps `gün` whole", () => {
    // The floor is load-bearing rather than copied, and this kind is where it
    // shows. "gün" is exactly three letters and its own tail looks like the
    // genitive `-ün`, so a stripper with a floor of 1 would offer the stem "g"
    // — and "g" is the gram, which is why this unit's symbol is the spelled word
    // and not the initial. At a floor of 3 the strip is refused, while "günde"
    // still comes back to a three-letter stem.
    expect(engine.evaluate("5 gün").value.unit).toBe("d");
    expect(engine.evaluate("5 günde").value.unit).toBe("d");
    expect(durationTr.units.d?.symbol).toBe("gün");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "5 saat",
      "1 dakika + 30 saniye",
      "1 saat to dakika",
      "1,5 saat",
      "2 gun",
      "2000 saniye",
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
