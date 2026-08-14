import { describe, expect, test } from "bun:test";
import { Decimal } from "../decimal";
import type { AnalyzeCtx, Slot } from "../types";
import { numberSymbols } from "./number";
import { russian } from "./ru";

const form = (n: number, slot: Slot = "bare") =>
  russian.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot });

const lemmas = (surface: string) => {
  const ctx: AnalyzeCtx = { locale: "ru", words: [surface], index: 0 };
  return (russian.analyze ?? []).flatMap((analyze) =>
    analyze(surface, ctx).map((f) => f.form),
  );
};

describe("russian", () => {
  test("keys are case x plural category", () => {
    expect(russian.id).toBe("ru");
    expect(form(1)).toBe("nom-one");
    expect(form(2)).toBe("nom-few");
    expect(form(5)).toBe("nom-many");
    expect(form(0)).toBe("nom-many");
    expect(form(11)).toBe("nom-many");
    expect(form(2000)).toBe("nom-many");
    // 21 and 22 are the pair that proves the category is not "look at the last
    // digit of a small number": 21 agrees like 1 ("21 килограмм"), 22 like 2
    // ("22 килограмма").
    expect(form(21)).toBe("nom-one");
    expect(form(22)).toBe("nom-few");
    // Fractional. "other" here is genitive *singular* — "1,5 килограмма" — not a
    // plural, which is the row a vocabulary is likeliest to get wrong.
    expect(form(1.5)).toBe("nom-other");
    expect(form(0.5)).toBe("nom-other");
  });

  test("the conversion target moves the whole key set into the other case", () => {
    // What `в` governs: "в 5 килограммах", never "в 5 килограммов".
    expect(form(1, "conversion-target")).toBe("loc-one");
    expect(form(2, "conversion-target")).toBe("loc-few");
    expect(form(5, "conversion-target")).toBe("loc-many");
    expect(form(1.5, "conversion-target")).toBe("loc-other");
  });

  test("a count-free conversion target still names a key", () => {
    // The row the one-dimensional `display` model could not express: no count to
    // select a number by, and a case the slot alone decides.
    expect(
      russian.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }),
    ).toBe("loc-other");
  });

  test("the key set is exactly eight, and nothing else is reachable", () => {
    // The contract every Russian `Vocabulary` keys its `forms` table off, pinned
    // here rather than described: spec §6 requires the keys a vocabulary
    // declares to be exactly the ones `selectForm` can produce, and this is the
    // enumeration of the second half of that sentence.
    const counts = [0, 1, 1.5, 2, 5, 11, 21, 22, 100, 1000];
    const slots: Slot[] = ["bare", "after-number", "conversion-target"];
    const keys = new Set<string>();
    for (const slot of slots) {
      keys.add(russian.selectForm({ kind: "mass", unit: "kg", slot }));
      for (const count of counts) {
        keys.add(
          russian.selectForm({
            count: new Decimal(count),
            kind: "mass",
            unit: "kg",
            slot,
          }),
        );
      }
    }
    expect([...keys].sort()).toEqual([
      "loc-few",
      "loc-many",
      "loc-one",
      "loc-other",
      "nom-few",
      "nom-many",
      "nom-one",
      "nom-other",
    ]);
  });

  test("reads cardinals, including the gendered and inflected forms", () => {
    expect(russian.numerals?.(["двадцать", "два"])).toEqual({
      value: new Decimal(22),
      consumed: 2,
    });
    // The hundreds are whole words that add, not "два сто": "двести пятьдесят"
    // is two addends, exactly as "двадцать пять" is.
    expect(russian.numerals?.(["двести", "пятьдесят"])).toEqual({
      value: new Decimal(250),
      consumed: 2,
    });
    // Feminine agreement and an inflected scale word, which is how a Russian
    // sentence writes 2000. Both are extra keys on the same values.
    expect(russian.numerals?.(["две", "тысячи"])).toEqual({
      value: new Decimal(2000),
      consumed: 2,
    });
    expect(russian.numerals?.(["пять", "тысяч"])).toEqual({
      value: new Decimal(5000),
      consumed: 2,
    });
    // сто is an addend here rather than a scale, and "сто тысяч" still reads as
    // a multiplication — the reason it can live in the hundreds table at all.
    expect(russian.numerals?.(["сто", "тысяч"])).toEqual({
      value: new Decimal(100_000),
      consumed: 2,
    });
    // Nothing beyond the numeral is claimed: the word after it stops the scan.
    expect(russian.numerals?.(["пять", "килограммов"])).toEqual({
      value: new Decimal(5),
      consumed: 1,
    });
    // "и" is not a numeral connector in Russian and is deliberately not declared
    // as one, so it stops the scan instead of being swallowed.
    expect(russian.numerals?.(["сто", "и", "пять"])).toEqual({
      value: new Decimal(100),
      consumed: 1,
    });
  });

  test("spells back through the same tables", () => {
    expect(russian.spell?.(new Decimal(0))).toBe("ноль");
    expect(russian.spell?.(new Decimal(22))).toBe("двадцать два");
    expect(russian.spell?.(new Decimal(15))).toBe("пятнадцать");
    // The fused hundreds, and the reason this language does not use the shared
    // `cardinalSpeller`: that one composes "два сто пятьдесят".
    expect(russian.spell?.(new Decimal(250))).toBe("двести пятьдесят");
    expect(russian.spell?.(new Decimal(105))).toBe("сто пять");
    // Scale agreement, the other half of the same reason. The multiplier is
    // feminine before тысяча and masculine before миллион, and the scale word
    // itself takes the one/few/many form the count calls for.
    expect(russian.spell?.(new Decimal(1000))).toBe("одна тысяча");
    expect(russian.spell?.(new Decimal(2000))).toBe("две тысячи");
    expect(russian.spell?.(new Decimal(5000))).toBe("пять тысяч");
    expect(russian.spell?.(new Decimal(1_000_000))).toBe("один миллион");
    expect(russian.spell?.(new Decimal(1_234_567))).toBe(
      "один миллион двести тридцать четыре тысячи пятьсот шестьдесят семь",
    );
    // The three documented `null` cases, each a property of the tables rather
    // than of the algorithm.
    expect(russian.spell?.(new Decimal("1.5"))).toBeNull();
    expect(russian.spell?.(new Decimal(-5))).toBeNull();
    expect(russian.spell?.(new Decimal("1e15"))).toBeNull();
  });

  test("what it spells, it reads back", () => {
    // The round trip is the property the one set of tables exists to guarantee:
    // every word the speller emits is a word the parser has an entry for.
    for (const n of [0, 5, 15, 22, 105, 250, 999, 1000, 2000, 5000, 21_345, 1_234_567]) {
      const spelled = russian.spell?.(new Decimal(n));
      expect(spelled).toBeString();
      expect(russian.numerals?.((spelled as string).split(" "))).toEqual({
        value: new Decimal(n),
        consumed: (spelled as string).split(" ").length,
      });
    }
  });

  test("the suffix stripper recovers a stem the vocabulary did not list", () => {
    // The prepositional plural — the "в …" row — and the genitive plural and
    // singular, which are the three endings a Russian unit noun is likeliest to
    // arrive in.
    expect(lemmas("килограммах")).toContain("килограмм");
    expect(lemmas("килограммов")).toContain("килограмм");
    expect(lemmas("килограмма")).toContain("килограмм");
    // `identity()` first, always: without it the language cannot reach its own
    // aliases at all.
    expect(lemmas("килограмм")[0]).toBe("килограмм");
    // `minStem: 3` is what keeps the two-letter symbols whole. "га" ends in a
    // listed suffix and would otherwise be handed to the resolver as "г".
    expect(lemmas("га")).toEqual(["га"]);
    expect(lemmas("кг")).toEqual(["кг"]);
  });

  test("claims the conversion and the helper keywords", () => {
    expect(russian.keywords.in).toContain("в");
    // Load-bearing rather than cosmetic, and the same pin `pl.test.ts` carries:
    // `Printer` writes `keywords.in[0]` in front of a `conversion-target`, and
    // `selectForm` answers that slot with the case *that one word* governs. "в"
    // takes the prepositional ("в граммах"); "до", two places along, takes the
    // genitive. Reorder this array and the printed preposition stops agreeing
    // with the printed noun — "до граммах", which is not Russian and which no
    // other test here would notice.
    expect(russian.keywords.in?.[0]).toBe("в");
    expect(russian.keywords.of).toContain("от");
    // "умножить на", "разделить на" — the helper word both operators need.
    expect(russian.keywords.by).toContain("на");
    // Deliberately unclaimed: Russian says "скидка 20% на 50", a noun phrase.
    expect(russian.keywords.off).toBeUndefined();
  });

  test("a spelled multiplication keeps the preposition its verb governs", () => {
    // The half of an operator `Printer` cannot know about: it spells one with
    // `keywords[<op>][0]` and nothing more, which is a whole word in English and
    // half of one here. "умножить" and "разделить" govern their right operand
    // through "на" — the very word `keywords.by` claims and `parse/wordops.ts`
    // swallows on the way in — so without this the printer emits "десять
    // килограммов умножить два", which reads back correctly and is not Russian.
    const render = (op: "*" | "/" | "+" | "-", word: string | undefined) =>
      russian.renderExpression?.({
        op,
        left: "десять",
        right: "два",
        ...(word !== undefined ? { word } : {}),
      });
    expect(render("*", "умножить")).toBe("десять умножить на два");
    expect(render("/", "разделить")).toBe("десять разделить на два");
    // "плюс" and "минус" stand on their own, so they are left exactly as
    // `defaultRenderExpression` writes them.
    expect(render("+", "плюс")).toBe("десять плюс два");
    expect(render("-", "минус")).toBe("десять минус два");
    // Unspelled — no `word` — is punctuation rather than grammar, and this
    // language has no opinion about it: byte for byte the default.
    expect(render("*", undefined)).toBe("десять * два");
    expect(render("+", undefined)).toBe("десять + два");
  });

  test("takes its number symbols from CLDR", () => {
    // An escape, not a literal: U+00A0 is invisible in source and degrades to a
    // plain space the moment anyone retypes the line, which is the same point
    // `parseNumber` makes about the same character.
    expect(numberSymbols(russian)).toEqual({ group: "\u00A0", decimal: "," });
  });
});
