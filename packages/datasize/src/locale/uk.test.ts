import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { ukrainian } from "@smartput/core/locale/uk";
import { assertLocaleContract } from "@smartput/core/testing";
import { datasize } from "../index";
import datasizeUk from "./uk";

const engine = createEngine({
  locales: [composeLocale(ukrainian, [datasizeUk])],
  kinds: [datasize],
});

describe("datasize uk vocabulary", () => {
  test("covers every unit the kind declares", () => {
    const units = Object.keys(
      datasize.value.mode === "ratio" ? datasize.value.units : {},
    );
    expect(Object.keys(datasizeUk.units).sort()).toEqual(units.sort());
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const [unit, words] of Object.entries(datasizeUk.units)) {
      expect(words.aliases.length, `${unit} has no aliases`).toBeGreaterThan(0);
      expect(words.symbol, `${unit} has no symbol`).toBeDefined();
    }
  });

  test("the SI prefix is lowercase and the IEC one is not", () => {
    // The contrast `kB` against `KiB` carries in Latin, written in Cyrillic.
    // Kilo is lowercase in SI in every language, and the rest of this repo's uk
    // vocabularies write it that way (`кг`, `км`, `кВт`, `кбіт`); IEC's binary
    // prefixes are `Ki`/`Mi`/`Gi`/`Ti` with a capital. The consumer-software
    // `КБ` is a transliterated `KB` and folds the two families' spellings toward
    // each other, so it is asserted against rather than left to preference.
    expect(datasizeUk.units.b?.symbol).toBe("Б");
    expect(datasizeUk.units.kb?.symbol).toBe("кБ");
    expect(datasizeUk.units.kib?.symbol).toBe("КіБ");
    // Mega and up are capital in both families, so only the `і` separates them.
    expect(datasizeUk.units.mb?.symbol).toBe("МБ");
    expect(datasizeUk.units.mib?.symbol).toBe("МіБ");
  });

  test("satisfies the locale contract", () => {
    expect(() =>
      assertLocaleContract(composeLocale(ukrainian, [datasizeUk]), [datasize]),
    ).not.toThrow();
  });

  // The boundary `datarate`'s Ukrainian symbols depend on, pinned here because
  // here is where it would be broken. Every unit in this kind is a **byte** unit
  // — `units.ts` canonicalizes on `b` with ratio 1 and spells it "byte" — so no
  // Cyrillic bit-word may appear in this vocabulary: "1 біт" registered against
  // `datasize` would resolve to one *byte*, wrong by the factor of 8 that
  // `@smartput/datarate`'s bridge signatures write out explicitly.
  //
  // The temptation is real and worth naming. `datarate` cannot print "Мбіт/с"
  // and read it back, and the shape that *would* fix it is the one `speed:mps`
  // uses — "/" lexes as an operator and `datasize ÷ duration` is a registered
  // signature — which needs "Мбіт" to be a datasize. It cannot be, while this
  // kind counts bytes; `datarate` prints the elided "Мбіт" instead.
  test("declares no bit-word, because every unit here is a byte", () => {
    for (const [unit, words] of Object.entries(datasizeUk.units)) {
      for (const word of words.aliases) {
        expect(word, `${unit} claims the bit-word "${word}"`).not.toMatch(/біт/);
      }
    }
  });

  test("an engine built from it reads and writes Ukrainian datasize", () => {
    // The plural boundary the whole eight-key table exists for: CLDR's `few`
    // (2-4) is the nominative plural, `many` (5-20, 0, 100...) is the genitive
    // plural, and English cannot tell them apart because English has one
    // plural.
    expect(engine.evaluate("2 кб").formatted).toBe("2 кілобайти");
    expect(engine.evaluate("5 кб").formatted).toBe("5 кілобайтів");
    // `other` is the *fractional* category, and a fraction takes the genitive
    // singular. "2,5 кілобайтів" would be the plausible-looking wrong answer,
    // and nothing but this assertion would catch it: the two spellings read
    // back to the same unit, so the round-trip below is blind to the
    // difference. The comma is the decimal mark `numberFormat: "intl"` reads
    // out of CLDR, not a choice made here.
    expect(engine.evaluate("2 кб + 500 б").formatted).toBe("2,5 кілобайта");
    // A conversion, and a Latin-script input: a Ukrainian engine has to read
    // `512 b` as readily as `512 б`, because nobody switches keyboard layouts
    // to type a unit.
    expect(engine.evaluate("512 b в кб").formatted).toBe("0,512 кілобайта");
    // Grouping, which for Ukrainian is U+00A0. Written as an escape because a
    // literal NBSP is invisible in source and degrades to a plain space the
    // moment someone retypes the line.
    expect(engine.evaluate("2 кб в байтах").formatted).toBe("2\u00A0000 байтів");
  });

  test("the conversion-target row the count-free locative exists for", () => {
    // `formatValue` renders a finished value with no expression around it, so
    // its slot is always "bare" and the assertions above only ever reach the
    // `nom-` half of the table. The `loc-` half is chosen by `Printer` from a
    // real position, which is Task 14's acceptance table — so what this package
    // can assert is the seam: the keys `ukrainian` asks for in a
    // conversion-target slot are keys this vocabulary answers, with the
    // locative words `в`/`у` actually govern.
    const forms = datasizeUk.units.b?.forms ?? {};
    const key = (count?: number) =>
      ukrainian.selectForm({
        ...(count === undefined ? {} : { count: new Decimal(count) }),
        kind: "datasize",
        unit: "b",
        slot: "conversion-target",
      });
    // "у 1 байті" — locative singular, the one row of the locative half that
    // is not the plural.
    expect(forms[key(1)]).toBe("байті");
    expect(forms[key(2)]).toBe("байтах");
    expect(forms[key(5)]).toBe("байтах");
    // No count at all (ruling R5): "1 кБ у байтах". This is the row the old
    // one-dimensional `display` model could not express.
    expect(key()).toBe("loc-other");
    expect(forms[key()]).toBe("байтах");
  });

  test("round-trips its own output", () => {
    for (const input of ["2 кб", "5 кб", "2 кб + 500 б", "512 б в кб"]) {
      const first = engine.evaluate(input);
      const again = engine.evaluate(first.formatted);
      expect(again.value.canonical.toFixed(), input).toBe(
        first.value.canonical.toFixed(),
      );
      expect(again.value.unit, input).toBe(first.value.unit);
    }
  });
});
