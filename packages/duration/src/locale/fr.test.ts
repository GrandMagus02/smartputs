import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { french } from "@smartput/core/locale/fr";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationFr from "./fr";

const locale = () => composeLocale(french, [durationFr]);
const engine = createEngine({ locales: [locale()], kinds: [duration] });

/** U+202F NARROW NO-BREAK SPACE — what `Intl.NumberFormat("fr")` groups with. */
const NNBSP = "\u202f";

/** Every key `french.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 0.5, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        french.selectForm({
          count: new Decimal(count),
          kind: "duration",
          unit: "h",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        french.selectForm({ kind: "duration", unit: "h", slot }),
      ),
    ),
);

describe("duration fr vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationFr.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationFr.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which French cannot borrow: the kind is Latin throughout, so a script test
  // would either pass vacuously or fail on the unit ids themselves. The
  // equivalent claim is the one that can still be made — the *words* this file
  // introduces appear nowhere in the language-free half, which is six ratios,
  // six unit ids and the magnitude bands `typical` records.
  test("the kind itself carries no French word", () => {
    const descriptor = JSON.stringify(duration);
    for (const word of ["seconde", "heure", "jour", "semaine", "milliseconde"]) {
      expect(descriptor, `the kind mentions "${word}"`).not.toMatch(
        new RegExp(`\\b${word}s?\\b`, "i"),
      );
    }
  });

  test("`french` asks for exactly two keys, and every unit fills both", () => {
    // The contract the language author pinned. CLDR's third French category
    // (`many`, on exact non-zero millions) is folded into `other` by
    // `selectForm`, because a French unit noun agrees with the number and not
    // with a scale word — which is why 1 000 000 does not show up as a third
    // key here.
    expect([...KEYS].sort()).toEqual(["one", "other"]);
    for (const [unit, words] of Object.entries(durationFr.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}`).toEqual(["one", "other"]);
    }
  });

  test("French is singular below two, which is where an English port breaks", () => {
    const key = (count: number) =>
      french.selectForm({
        count: new Decimal(count),
        kind: "duration",
        unit: "h",
        slot: "bare",
      });
    expect(key(0)).toBe("one");
    expect(key(1)).toBe("one");
    expect(key(1.5)).toBe("one");
    expect(key(2)).toBe("other");
    // And the slot axis is inert: a French unit noun does not inflect for case,
    // so a conversion target selects by count alone.
    expect(
      french.selectForm({ kind: "duration", unit: "h", slot: "conversion-target" }),
    ).toBe("other");
  });

  test("every string it can print is a string it can read", () => {
    for (const [unit, words] of Object.entries(durationFr.units)) {
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds a full stop, which lex ends a word on`,
      ).not.toMatch(/\./);
      expect(
        words.aliases.map((a) => a.toLowerCase()),
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      // Rule 5: a form the printer emits must be a form the parser reads at
      // full weight, not one `french.analyze`'s `-2` suffix stripper happens to
      // recover. Every plural here is a regular -s, so the stripper *would*
      // recover it — which is exactly why the check is on the alias list rather
      // than on whether the engine copes.
      for (const form of Object.values(words.forms ?? {})) {
        expect(words.aliases, `${unit}: "${form}" is printed but not readable`).toContain(
          form,
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [duration])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. In French that category is "one", not English's "other",
    // so a table ported by renaming columns would point every 1,5 row at the
    // plural and this sweep is the line that notices.
    expect(() =>
      assertLocaleContract(locale(), [duration], {
        counts: [0, 0.5, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes French duration", () => {
    // French noun in, French noun out, with the space `french.renderQuantity`
    // sets before every label.
    expect(engine.evaluate("2 heures").formatted).toBe("2 heures");
    expect(engine.evaluate("2 h").formatted).toBe("2 heures");
    expect(engine.evaluate("30 mn").formatted).toBe("30 minutes");
    expect(engine.evaluate("3 j").formatted).toBe("3 jours");
    expect(engine.evaluate("2 sem").formatted).toBe("2 semaines");
    // English aliases still read: they arrive from the one map in `units.ts`
    // before the French spellings are appended to it.
    expect(engine.evaluate("2 hours").formatted).toBe("2 heures");
    // A conversion, written with "en" — and one whose target crosses the
    // grouping threshold, so the narrow no-break space shows.
    expect(engine.evaluate("2 heures en secondes").formatted).toBe(
      `7${NNBSP}200 secondes`,
    );
    // ...and with "vers", the directional preposition listed beside it.
    expect(engine.evaluate("1 jour vers heures").formatted).toBe("24 heures");
    // A sum landing on a fraction — the decimal comma, and the singular that
    // makes French different from English at exactly this value.
    expect(engine.evaluate("1 heure + 30 minutes").formatted).toBe("1,5 heure");
    expect(engine.evaluate("90 minutes en heures").formatted).toBe("1,5 heure");
    // Zero is singular too: "zéro seconde".
    expect(engine.evaluate("1 seconde - 1 seconde").formatted).toBe("0 seconde");
    // And two is where the plural starts.
    expect(engine.evaluate("1 heure + 1 heure").formatted).toBe("2 heures");
  });

  test("its own output reads back to the same value", () => {
    // The round trip the narrow no-break space makes worth pinning: `normalize`
    // folds every `\s` run to one plain space before `lex` sees it, so
    // "7 200 secondes" arrives spelled with U+0020 and is held together by the
    // lexer's three-digit lookahead rather than by the character itself.
    for (const input of [
      "2 heures",
      "1 heure + 30 minutes",
      "2 heures en secondes",
      "1,5 jour",
      "3 j",
      "2 sem",
    ]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value?.canonical.toString(), input).toBe(
        first.value?.canonical.toString(),
      );
      expect(again.value?.unit, input).toBe(first.value?.unit);
    }
  });
});
