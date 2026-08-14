import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { german } from "@smartput/core/locale/de";
import { assertLocaleContract } from "@smartput/core/testing";
import { duration } from "../index";
import durationDe from "./de";

const locale = () => composeLocale(german, [durationDe]);
const engine = createEngine({ locales: [locale()], kinds: [duration] });

/** Every key `german.selectForm` can hand this kind, swept rather than assumed. */
const KEYS = new Set(
  [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000]
    .flatMap((count) =>
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({
          count: new Decimal(count),
          kind: "duration",
          unit: "d",
          slot,
        }),
      ),
    )
    .concat(
      (["bare", "after-number", "conversion-target"] as const).map((slot) =>
        german.selectForm({ kind: "duration", unit: "d", slot }),
      ),
    ),
);

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = german.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "duration",
    unit,
    slot,
  });
  return (durationDe.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

describe("duration de vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      duration.value.mode === "ratio" ? duration.value.units : {},
    );
    expect(Object.keys(durationDe.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(durationDe.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // The Ukrainian file next door asserts this with a Cyrillic script regex,
  // which German cannot borrow: the kind is already full of Latin letters. What
  // German has instead is orthography — every German noun is capitalised, so a
  // German word reaching the language-free half arrives with a capital, and the
  // descriptor (ratios, unit ids and magnitude bands) has none. The word list is
  // the second half of the same claim, for the lowercase clipped forms.
  test("the kind itself carries no German word", () => {
    const descriptor = JSON.stringify(duration);
    expect(descriptor).not.toMatch(/\p{Lu}/u);
    for (const german_ of ["sekunde", "minute", "stunde", "tag", "woche", "std", "sek"]) {
      expect(descriptor, `the kind mentions "${german_}"`).not.toMatch(
        new RegExp(`\\b${german_}n?\\b`, "i"),
      );
    }
  });

  test("every unit carries exactly the four keys `german` can ask for", () => {
    // The contract the language author pinned: case from the slot (a conversion
    // target is dative, everything else nominative) crossed with the two
    // categories `Intl.PluralRules("de")` declares. A count-free target lands on
    // `dat-other` (ruling R5), which is why the sweep above includes the
    // countless call. Rule 6 wants exactly this set — no more, no fewer.
    expect([...KEYS].sort()).toEqual(["dat-one", "dat-other", "nom-one", "nom-other"]);
    for (const [unit, words] of Object.entries(durationDe.units)) {
      expect(Object.keys(words.forms ?? {}).sort(), `${unit}'s keys`).toEqual(
        [...KEYS].sort(),
      );
    }
  });

  test("every string it can print is a string it can read", () => {
    // `assertLocaleContract` walks the alias list and proves each alias
    // resolves; it never asks whether the strings the *printer* emits are among
    // them. Those are different sets, and the gap between them is where a
    // printer that cannot read its own output lives — "in 7 Tagen" is the row
    // that would sit in it, since no other unit here needs `Tagen` at all.
    for (const [unit, words] of Object.entries(durationDe.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        symbol,
        `${unit}'s symbol "${symbol}" holds an operator character`,
      ).not.toMatch(/[/*+\-·×⋅]/);
      expect(folded, `${unit}'s symbol "${symbol}" is not among its aliases`).toContain(
        symbol.toLowerCase(),
      );
      for (const form of Object.values(words.forms ?? {})) {
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [duration])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers, so they never reach the category a
    // fraction takes. German folds that into `other`, which is the claim worth
    // sampling rather than assuming: if `selectForm` ever grows a third CLDR
    // row, this is the line that notices before a user does.
    expect(() =>
      assertLocaleContract(locale(), [duration], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("`Tag` moves on both axes and `Stunde` on only one", () => {
    // The whole argument for a two-axis table, in eight assertions. A strong
    // masculine spends three different words across four keys; a feminine spends
    // two, because its dative plural is already its nominative plural.
    expect(word("d", 1)).toBe("Tag");
    expect(word("d", 2)).toBe("Tage");
    expect(word("d", 1.5)).toBe("Tage");
    expect(word("d", 1, "conversion-target")).toBe("Tag");
    // The `-n` no other language in this repo marks, and the row a one-axis
    // plural model cannot reach: a conversion target has no magnitude to agree
    // with (ruling R5), so it lands on `dat-other` and prints "in Tagen".
    expect(word("d", 7, "conversion-target")).toBe("Tagen");
    expect(word("d", undefined, "conversion-target")).toBe("Tagen");
    expect(word("h", 2)).toBe("Stunden");
    expect(word("h", undefined, "conversion-target")).toBe("Stunden");
  });

  test("an engine built from it reads and writes German duration", () => {
    expect(engine.evaluate("1 Stunde").formatted).toBe("1 Stunde");
    expect(engine.evaluate("2 Stunden").formatted).toBe("2 Stunden");
    // Case-folding, both directions: the alias index lowercases, so the capital
    // a German writes and the lowercase a search box gets are one key.
    expect(engine.evaluate("2 stunden").formatted).toBe("2 Stunden");
    expect(engine.evaluate("2 STUNDEN").formatted).toBe("2 Stunden");
    // The clipped forms, listed without the full stop German writes them with.
    expect(engine.evaluate("2 Std").formatted).toBe("2 Stunden");
    expect(engine.evaluate("30 Sek").formatted).toBe("30 Sekunden");
    // A conversion, with each of the three prepositions the language lists under
    // `in`. The result is a bare value, so it prints nominative however the
    // target was spelled — the dative belongs to the target word, which only a
    // spelled print reaches.
    expect(engine.evaluate("1 Tag in Stunden").formatted).toBe("24 Stunden");
    expect(engine.evaluate("1 Woche nach Tagen").formatted).toBe("7 Tage");
    expect(engine.evaluate("1 Woche zu Tage").formatted).toBe("7 Tage");
    // A sum landing on a fraction, which is where the decimal comma shows.
    // Written with a comma on purpose: "1.5" is fifteen hundred in German, so a
    // test spelled with a full stop would be exercising the group separator.
    expect(engine.evaluate("1 Stunde + 30 Minuten").formatted).toBe("1,5 Stunden");
    // ...and the group separator itself, which is a full stop where English
    // writes a comma.
    expect(engine.evaluate("1 Stunde in Sekunden").formatted).toBe("3.600 Sekunden");
  });

  test("a weekday is not a count of days", () => {
    // The other half of `german`'s ruling that `tag` is not a compound head. All
    // seven weekday names end in it, so a head list containing it would read
    // "2 Montag" as two days; the alias index matches whole tokens, so listing
    // "tag" here claims "Tag" and nothing else. This is the row that fails if
    // `tag` is ever added to `COMPOUND_HEADS` on the theory that it would help.
    expect(() => engine.evaluate("2 Montag")).toThrow();
    expect(engine.evaluate("2 Tag").value.unit).toBe("d");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "2 Stunden",
      "1 Stunde + 30 Minuten",
      "1 Tag in Stunden",
      "1,5 Tage",
      "3 Wochen",
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
