import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { power } from "../index";
import powerId from "./id";

const locale = () => composeLocale(indonesian, [powerId]);
const engine = createEngine({ locales: [locale()], kinds: [power] });

/** The word this vocabulary hands back for a given count and slot. */
const word = (unit: string, count: number | undefined, slot = "bare") => {
  const key = indonesian.selectForm({
    ...(count === undefined ? {} : { count: new Decimal(count) }),
    kind: "power",
    unit,
    slot,
  });
  return (powerId.units as Record<string, { forms?: Record<string, string> }>)[unit]
    ?.forms?.[key];
};

/** Every key `indonesian.selectForm` can produce, swept rather than assumed. */
const KEYS = new Set(
  (["bare", "after-number", "conversion-target"] as const).flatMap((slot) => [
    indonesian.selectForm({ kind: "power", unit: "w", slot }),
    ...[0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000].map((count) =>
      indonesian.selectForm({
        count: new Decimal(count),
        kind: "power",
        unit: "w",
        slot,
      }),
    ),
  ]),
);

describe("power id vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(power.value.mode === "ratio" ? power.value.units : {});
    expect(Object.keys(powerId.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(powerId.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  // `uk.test.ts` makes this claim with a Cyrillic script regex, which Indonesian
  // cannot borrow — the kind is already full of Latin letters — and German's
  // substitute (every noun carries a capital) does not transfer either, since
  // Indonesian capitalises no common noun. So the words are the check. *Watt*
  // and its prefixes are bound in `units.ts` as aliases, which is the other half
  // of the same separation; what may appear nowhere in a kind that is five
  // ratios, unit ids and magnitude bands are the Indonesian words for the
  // horsepower, and the abbreviation this file deliberately refuses.
  test("the kind itself carries no Indonesian word", () => {
    expect(JSON.stringify(power)).not.toMatch(/tenaga|\bkuda\b|daya kuda|\bpk\b|\bdk\b/i);
  });

  test("`indonesian` asks for exactly one key, and every unit but `hp` fills it", () => {
    // The contract the language author pinned, restated where a vocabulary can
    // see it: `selectForm` is the constant `() => "other"` because Indonesian
    // has no grammatical plural, no gender and no case. The sweep includes a
    // count-free call (R5) and 1e6, so a CLDR `many` row would surface here
    // rather than at a user. Rule 6 wants exactly this set — one row — and it
    // wants an *empty* set from `hp`, whose Indonesian name is two words.
    expect([...KEYS]).toEqual(["other"]);
    for (const [unit, words] of Object.entries(powerId.units)) {
      if (unit === "hp") {
        expect(words.forms, "hp declares a form").toBeUndefined();
      } else {
        expect(Object.keys(words.forms ?? {}), `${unit}`).toEqual(["other"]);
      }
    }
  });

  test("every string it prints is a string it reads", () => {
    // Compared case-folded because that is what the registry does:
    // `buildRegistry` lowercases an alias before indexing it, so the SI capital
    // in "kW" meets the derived lowercase "kw" and a symbol never has to be
    // listed twice. What this catches is the other thing — a printed word
    // reachable only through an analyzer, by accident rather than by
    // declaration. Indonesian cannot afford that gap at all, since
    // `indonesian.analyze` is `[identity()]` and there is no stripper behind it.
    for (const [unit, words] of Object.entries(powerId.units)) {
      const folded = words.aliases.map((a) => a.toLowerCase());
      const symbol = words.symbol as string;
      expect(
        folded,
        `${unit}'s symbol "${symbol}" is not among its own aliases`,
      ).toContain(symbol.toLowerCase());
      for (const form of Object.values(words.forms ?? {})) {
        expect(form, `${unit}: "${form}" is more than one token`).not.toMatch(/\s/u);
        expect(folded, `${unit}: "${form}" is printed but not readable`).toContain(
          form.toLowerCase(),
        );
      }
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale(), [power])).not.toThrow();
  });

  test("satisfies it with a fractional count too", () => {
    // The default counts are all integers and never reach the category a
    // fraction takes. Indonesian folds it into `other` along with everything
    // else — `selectForm`'s decision rather than arithmetic, so it is sampled.
    expect(() =>
      assertLocaleContract(locale(), [power], {
        counts: [0, 1, 1.5, 2, 5, 11, 21, 100, 1000],
      }),
    ).not.toThrow();
  });

  test("the noun is invariant, and `hp` has no noun to be invariant about", () => {
    // The substance of a one-key table, measured rather than restated. A Dutch
    // or German file has to argue which of its units is invariant and which is
    // marked — `nl.ts` next door writes *paardenkracht* beside *paardenkrachten*
    // — while Indonesian has no marked unit anywhere in the language, so the
    // assertion worth making is that the axis is genuinely absent rather than
    // merely unexercised by the units chosen.
    for (const unit of ["w", "kw", "mw", "gw"]) {
      const one = word(unit, 1);
      expect(one, unit).toBeDefined();
      expect(word(unit, 0), unit).toBe(one);
      expect(word(unit, 2), unit).toBe(one);
      expect(word(unit, 1.5), unit).toBe(one);
      expect(word(unit, 1_000_000), unit).toBe(one);
      // A conversion target carries no count and every language must still
      // answer (R5); the slot changes nothing, because there is no case for a
      // preposition to govern — "dalam kilowatt" holds the word "dua kilowatt"
      // holds.
      expect(word(unit, undefined, "conversion-target"), unit).toBe(one);
    }
    expect(word("w", 2)).toBe("watt");
    expect(word("gw", 2)).toBe("gigawatt");
    // And the one whose Indonesian name is two words, so there is nothing for
    // any key to hold.
    expect(word("hp", 2)).toBeUndefined();
  });

  test("the metric horsepower is not claimed under any spelling", () => {
    // The finding the vocabulary's doc comment argues, pinned so it cannot be
    // "fixed" by a later translator. Indonesian writes "PK" for the horsepower —
    // an air conditioner is sold as "AC 1 PK" — but *PK* is Dutch
    // *paardenkracht*, the **metric** horsepower of 735.49875 W, while this
    // kind's `hp` is the **mechanical** one at 745.69987158227022 W. Binding the
    // two would be a silent 1.4% error with nothing to notice it: same kind,
    // same unit, one alias, no ambiguity for the solver to rank. The unit
    // Indonesian means is simply absent from the kind, and adding it is
    // `units.ts`'s decision rather than a vocabulary's (rule 2).
    const claimed = Object.values(powerId.units).flatMap((w) =>
      w.aliases.map((a) => a.toLowerCase()),
    );
    for (const w of ["pk", "dk", "ps"]) {
      expect(claimed, `"${w}" names the metric horsepower and is claimed`).not.toContain(
        w,
      );
    }
    // And the ratio the refusal is about, so the two numbers sit beside each
    // other in one place rather than in a comment.
    expect(engine.evaluate("1 hp ke watt").value.canonical.toString()).toBe(
      "745.69987158227022",
    );
    expect(() => engine.evaluate("1 pk")).toThrow();
  });

  test("an engine built from it reads and writes Indonesian power", () => {
    // Borrowed whole, so the Indonesian noun and the English one are the same
    // string and only the grouping and the symbol casing tell the two apart.
    expect(engine.evaluate("2 watt").formatted).toBe("2 watt");
    expect(engine.evaluate("2 watts").formatted).toBe("2 watt");
    expect(engine.evaluate("2 kilowatt").formatted).toBe("2 kilowatt");
    // Conversions, with both particles the language lists under `in`. Grouping
    // is a full stop, from CLDR through `numberFormat: "intl"`.
    expect(engine.evaluate("2 kw dalam watt").formatted).toBe("2.000 watt");
    expect(engine.evaluate("2 kw ke watt").formatted).toBe("2.000 watt");
    expect(engine.evaluate("1500 watt dalam kw").formatted).toBe("1,5 kilowatt");
    // A sum landing on a fraction, in both spellings of addition. Written with a
    // comma on purpose: "1.5" is fifteen hundred here, so a test spelled with a
    // full stop would be exercising the group separator instead.
    expect(engine.evaluate("1 kw + 500 w").formatted).toBe("1,5 kilowatt");
    expect(engine.evaluate("1 kw tambah 500 w").formatted).toBe("1,5 kilowatt");
    // The remaining word operators the language claims.
    expect(engine.evaluate("2 kw kurang 500 w").formatted).toBe("1,5 kilowatt");
    expect(engine.evaluate("3 kw kali 2").formatted).toBe("6 kilowatt");
    expect(engine.evaluate("3 kw bagi 2").formatted).toBe("1,5 kilowatt");
    // The one unit with no Indonesian noun, printing on its symbol and set tight
    // by `defaultRenderQuantity` — the cost `@smartput/core/locale/id` takes
    // when it declines a `renderQuantity`, bounded here to a single unit.
    expect(engine.evaluate("2 hp").formatted).toBe("2 hp");
    expect(engine.evaluate("2 horsepower").formatted).toBe("2 hp");
  });

  test("its own output reads back to the same value", () => {
    for (const input of [
      "2 watt",
      "2 kw dalam watt",
      "1500 watt dalam kw",
      "1 kw tambah 500 w",
      "2 hp",
      "2000 w",
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
