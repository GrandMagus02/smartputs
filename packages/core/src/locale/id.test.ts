import { describe, expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import type { Slot } from "../types";
import { createAnalyzerChain } from "./analyze";
import { buildKeywords, composeLocale } from "./compose";
import { english } from "./en";
import { type CardinalTables, cardinalNumerals } from "./helpers";
import { indonesian } from "./id";
import { numberSymbols, parseNumber } from "./number";
import { defineVocabulary } from "./vocabulary";

const form = (n: number, slot: Slot = "bare") =>
  indonesian.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot });

describe("indonesian", () => {
  /**
   * The headline claim of `id.ts`, asserted as a fact about the object rather
   * than left in its doc comment: five fields, and the five are these. A sixth
   * appearing here is not a bug on its own — but it is the moment the file
   * stops being the floor it is written to demonstrate, so it should fail and
   * be argued for rather than land quietly.
   */
  test("five fields, and no more", () => {
    expect(indonesian.id).toBe("id");
    expect(Object.keys(indonesian).sort()).toEqual([
      "analyze",
      "id",
      "keywords",
      "numberFormat",
      "selectForm",
    ]);
    // Named individually too, because the sorted-keys row above says only that
    // they are absent and not which absences were deliberate. Latin script,
    // spaced words: nothing to segment. No numerals: see the finding at the
    // bottom of this file.
    expect(indonesian.segment).toBeUndefined();
    expect(indonesian.numerals).toBeUndefined();
    expect(indonesian.spell).toBeUndefined();
    expect(indonesian.renderQuantity).toBeUndefined();
  });

  test("one key, for every count and every slot", () => {
    // The contract three later vocabularies key their `forms` tables off, and
    // the strongest form of it: sweep the slots against a spread of counts —
    // zero, one, a fraction, a plural, a large round number — and the set that
    // comes back has one member.
    const keys = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"] as Slot[]) {
      for (const n of [0, 1, 1.5, 2, 5, 11, 21, 100, 1_000_000]) keys.add(form(n, slot));
      keys.add(indonesian.selectForm({ kind: "mass", unit: "kg", slot }));
    }
    expect([...keys]).toEqual(["other"]);
  });

  test("CLDR agrees that there is one category, which is what pins the constant", () => {
    // `selectForm` returns a constant rather than calling `plural.select`, so
    // this is the assertion that keeps the constant honest: Indonesian is in
    // CLDR's no-plural group, and the day a runtime disagrees this row fails
    // instead of the language quietly selecting a row no vocabulary declares.
    expect(new Intl.PluralRules("id").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
  });

  test("a count-free conversion target still names a key", () => {
    // Ruling R5: "1 kg dalam gram" has no magnitude to agree "gram" with, and
    // the row still has to exist. It is the same row, because Indonesian has
    // only the generic one — and `other` is the category CLDR requires every
    // locale to define as exactly that.
    expect(
      indonesian.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }),
    ).toBe("other");
  });

  test("takes its number symbols from CLDR", () => {
    // Both are visible characters, unlike Ukrainian's U+00A0 group separator,
    // so they are written as themselves. They are Dutch and German's pair and
    // the exact inverse of English's, which is the fact a reader of this file
    // most needs pinned: under this language "1.500" is fifteen hundred and
    // "1,5" is three halves.
    expect(numberSymbols(indonesian)).toEqual({ group: ".", decimal: "," });
  });

  test("and reads numbers back with them", () => {
    // The pair above as behaviour rather than as two strings, since the
    // separators only matter for what `parseNumber` does with them.
    expect(parseNumber("1.500", indonesian)?.toString()).toBe("1500");
    expect(parseNumber("1,5", indonesian)?.toString()).toBe("1.5");
    expect(parseNumber("1.234.567,5", indonesian)?.toString()).toBe("1234567.5");
  });
});

describe("indonesian keywords", () => {
  test("claims the conversion words", () => {
    // "ke" is the directional "to", "dalam" is "in".
    expect(indonesian.keywords.in).toEqual(["ke", "dalam"]);
    expect(indonesian.keywords.of).toEqual(["dari"]);
    expect(indonesian.keywords.plus).toEqual(["tambah"]);
    expect(indonesian.keywords.minus).toEqual(["kurang"]);
    expect(indonesian.keywords.times).toEqual(["kali"]);
    expect(indonesian.keywords.over).toEqual(["bagi"]);
  });

  test("claims neither off nor by, and both absences are decisions", () => {
    // "diskon" comes in front of both operands ("diskon 20% dari 50") where
    // `off` is an infix, so there is no spelling this parser could accept.
    expect(indonesian.keywords.off).toBeUndefined();
    // `by` exists only to be swallowed by an operator word; "bagi" and "kali"
    // are complete on their own, and the particles that would fill the role
    // ("dengan", "oleh") are among the commonest prepositions in the language.
    expect(indonesian.keywords.by).toBeUndefined();
  });

  test("no surface word is claimed for two different keywords", () => {
    // The check `buildKeywords` makes at boot, made here over one language so a
    // conflict inside this table is an Indonesian test failure rather than an
    // engine one.
    const seen = new Map<string, string>();
    for (const [keyword, words] of Object.entries(indonesian.keywords)) {
      for (const word of words ?? []) {
        expect(seen.get(word) ?? keyword).toBe(keyword);
        seen.set(word, keyword);
      }
    }
  });

  test("installs beside English without folding into it anywhere", () => {
    // Indonesian claims no surface English claims — notably not "in", which is
    // the tag ISO 639-1 used for this language until 1989 and which every
    // `Intl` constructor now canonicalises to "id". So the two tables merge
    // with nothing to reconcile: English keeps "in", Indonesian's "ke" and
    // "dalam" arrive beside it, and all three mean the same `Keyword`.
    const table = buildKeywords([composeLocale(english), composeLocale(indonesian)]);
    expect(table.get("in")).toBe("in");
    expect(table.get("ke")).toBe("in");
    expect(table.get("dalam")).toBe("in");
    expect(new Intl.Locale("in").toString()).toBe("id");
  });
});

describe("indonesian morphology is one analyzer long", () => {
  const chain = createAnalyzerChain(indonesian);

  test.each(["kilogram", "gram", "kilo", "meter", "detik", "Kilogram", "KG"])(
    "%s analyzes to itself and to nothing else",
    (surface) => {
      // A counted noun is invariant, so there is no ending to strip and no
      // compound to cut: the chain offers the word as typed, at weight 0, and
      // stops. A second form here would mean some analyzer had been added that
      // guesses — and a penalised guess still competes.
      expect(chain(surface)).toEqual([{ form: surface, weight: 0 }]);
    },
  );
});

/**
 * The one thing the shipped helpers cannot do for this language, written as a
 * test for the reason `third-language.test.ts` writes its two: the day
 * `cardinalNumerals` grows a second sub-thousand scale, this fails and gets
 * rewritten, rather than staying quietly true and telling a reader the limit is
 * still there.
 *
 * `TABLE` below is the most charitable Indonesian table the shape allows —
 * `puluh` and `belas` declared as scales, the fused `se-` forms declared
 * whole — so the failures are the shape's and not a badly written table's.
 */
describe("cardinalNumerals cannot express an Indonesian hundred", () => {
  const TABLE: CardinalTables = {
    units: {
      nol: 0,
      satu: 1,
      dua: 2,
      tiga: 3,
      empat: 4,
      lima: 5,
      enam: 6,
      tujuh: 7,
      delapan: 8,
      sembilan: 9,
      // Fused with the "se-" that means one, so each is a single word and an
      // addend in its own right.
      sepuluh: 10,
      sebelas: 11,
    },
    tens: {},
    scales: {
      // The two multipliers below a thousand, which is one more than the shared
      // helper's model has room for.
      puluh: 10,
      belas: 10,
      ratus: 100,
      seratus: 100,
      ribu: 1_000,
      seribu: 1_000,
      juta: 1_000_000,
    },
  };
  const read = cardinalNumerals(TABLE);

  test("what it does get right, so the failures below are not the whole language", () => {
    expect(read(["lima"])).toEqual({ value: new Decimal(5), consumed: 1 });
    expect(read(["dua", "puluh", "lima"])).toEqual({
      value: new Decimal(25),
      consumed: 3,
    });
    expect(read(["seribu", "lima", "ratus"])).toEqual({
      value: new Decimal(1500),
      consumed: 3,
    });
    // Not a numeral at all is a refusal, which is the one safe answer.
    expect(read(["kilogram"])).toBeNull();
  });

  test("a hundred and a ten in one group multiply instead of adding", () => {
    // 125. The helper flushes an accumulated group into the total only at a
    // scale of a thousand or more, so `ratus` and `puluh` compose within the
    // group: 100, +2, ×10, +5.
    expect(read(["seratus", "dua", "puluh", "lima"])?.value.toString()).toBe("1025");
    // And the wrong number is claimed with confidence — all four words
    // consumed, no refusal for a caller to fall back from. That is the failure
    // German's `einundzwanzig` row records, and the reason `id.ts` ships no
    // `numerals` rather than these tables.
    expect(read(["seratus", "dua", "puluh", "lima"])?.consumed).toBe(4);
  });

  test("belas is additive and no row can say so", () => {
    // 12: units before the ten, joined rather than multiplied. Declared as a
    // scale it multiplies (2×10); left out altogether it is worse still, since
    // the fold then claims "dua" alone and answers 2.
    expect(read(["dua", "belas"])?.value.toString()).toBe("20");
    expect(read(["sembilan", "belas"])?.value.toString()).toBe("90");
  });
});

/**
 * The floor as a working language, which is the claim the field count is only
 * evidence for. One vocabulary, one `forms` row per unit, and Indonesian reads
 * and writes a sentence.
 */
describe("the floor is a language", () => {
  const ID_MASS = defineVocabulary({
    locale: "id",
    kind: "mass",
    units: {
      // Every string the table can print is also one it can read: the `forms`
      // row and the `symbol` are both listed among the aliases, which is the
      // rule `assertLocaleContract`'s third check enforces and the one a
      // language with no analyzer chain to fall back on cannot afford to break.
      kg: { aliases: ["kg", "kilogram"], symbol: "kg", forms: { other: "kilogram" } },
      g: { aliases: ["g", "gram"], symbol: "g", forms: { other: "gram" } },
      t: { aliases: ["t", "ton"], symbol: "t", forms: { other: "ton" } },
    },
  });

  const engine = createEngine({
    locales: [composeLocale(indonesian, [ID_MASS])],
    kinds: BUILTIN_KINDS,
    format: "id",
  });

  test.each([
    // The decimal comma on the way in and on the way out, and the one form.
    ["1,5 kg", "1,5 kilogram"],
    // One and many take the same noun, which is the whole of Indonesian
    // agreement: these two rows would be different words in every other
    // language in this directory.
    ["1 kilogram", "1 kilogram"],
    ["5 kilogram", "5 kilogram"],
    ["0 kilogram", "0 kilogram"],
    // A conversion, through both spellings of the keyword, with the group
    // separator on the result.
    ["2 kg dalam gram", "2.000 gram"],
    ["2 kg ke gram", "2.000 gram"],
    // The word operators, so `keywords` is measured by what it parses rather
    // than by what it lists.
    ["1 kg tambah 500 gram", "1,5 kilogram"],
    ["2 kg kurang 500 gram", "1,5 kilogram"],
    ["3 kg kali 2", "6 kilogram"],
    ["3 kg bagi 2", "1,5 kilogram"],
  ])("%s prints as %s", (input, expected) => {
    expect(engine.evaluate(input).formatted).toBe(expected);
  });

  test("every word this vocabulary can print reads back", () => {
    // The sweep `third-language.test.ts` runs for German, over the one thing
    // that matters here: with a single-analyzer chain there is no stripper to
    // rescue a printed form, so a `forms` row that is not also an alias is
    // unreadable outright rather than merely penalised.
    const problems: string[] = [];
    for (const [unit, words] of Object.entries(ID_MASS.units)) {
      for (const printed of [...Object.values(words.forms ?? {}), words.symbol]) {
        if (printed === undefined) continue;
        const back = engine.evaluate(`7 ${printed}`);
        if (back.value.unit !== unit) {
          problems.push(
            `${unit}: ${JSON.stringify(printed)} read back as ${back.value.unit}`,
          );
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
