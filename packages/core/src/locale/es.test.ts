import { describe, expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import { formatNumber } from "../format/format";
import type { Slot } from "../types";
import { composeLocale } from "./compose";
import { spanish } from "./es";
import { CARDINALS } from "./es-cardinals";
import { cardinalNumerals } from "./helpers";
import { numberSymbols, parseNumber } from "./number";
import { defineVocabulary } from "./vocabulary";

const form = (n: number, slot: Slot = "bare") =>
  spanish.selectForm({ count: new Decimal(n), kind: "length", unit: "m", slot });

const spell = (n: number) => spanish.spell?.(new Decimal(n));
const read = (words: string) => spanish.numerals?.(words.split(" "));

describe("spanish", () => {
  test("takes its number symbols from CLDR", () => {
    // Written out because the brief that commissioned this language said U+00A0,
    // and CLDR's default content for the bare `es` tag says otherwise: the
    // group separator is a plain full stop and the decimal mark is a comma.
    // U+00A0 grouping is real Spanish, but it belongs to the regional variants
    // (es-MX and es-419 among them), and a regional variant is a `Language` with
    // an id of its own rather than a flag on this one. Pinned as an assertion
    // because it is the platform's answer and not this file's: `numberFormat`
    // is `"intl"`, so the day ICU moves, this row is what says so.
    expect(numberSymbols(spanish)).toEqual({ group: ".", decimal: "," });
    expect(spanish.id).toBe("es");
  });

  test("the engine groups every three digits, where CLDR would leave four ungrouped", () => {
    // Spanish sets `minimumGroupingDigits` to 2, so ICU writes a four-digit
    // number with no separator at all and a five-digit one with one.
    expect(new Intl.NumberFormat("es").format(2000)).toBe("2000");
    expect(new Intl.NumberFormat("es").format(20000)).toBe("20.000");
    // `formatNumber` does not honour that, and the divergence is structural
    // rather than an oversight: it cannot hand a `Decimal` to `Intl` without
    // losing digits, so it takes only the two *symbols* from CLDR and groups the
    // digit string itself, uniformly every three. `numberFormat: "intl"` is
    // therefore a claim about the separators and not about the grouping policy,
    // which is worth knowing before a Spanish vocabulary's tests are written —
    // the engine writes "2.000 metros" where a native reader might expect
    // "2000 metros". Pinned here so the expectation is set in one place.
    expect(new Intl.NumberFormat("es").format(2000)).not.toBe(
      formatNumber(new Decimal(2000), spanish),
    );
    expect(formatNumber(new Decimal(2000), spanish)).toBe("2.000");
    // What the uniform grouping buys, and the reason it stays: the printed form
    // reads back as the number it came from, which `minimumGroupingDigits` would
    // not have changed here but which is the property `formatNumber` is written
    // against.
    expect(parseNumber("2.000", spanish)?.toString()).toBe("2000");
    expect(parseNumber("1,5", spanish)?.toString()).toBe("1.5");
  });
});

/**
 * The contract three vocabularies will key their `forms` tables off: exactly
 * two rows, `one` and `other`, for every count and every slot.
 */
describe("selectForm returns exactly one | other", () => {
  test("each key, and the counts that reach it", () => {
    // The only count that is `one` in Spanish. 1,0 is the same category and
    // -1 never reaches here (a negative magnitude is a `UnaryNode` over a
    // positive one), so this row is the whole of `one`.
    expect(form(1)).toBe("one");
    // Everything else, including the two a reader expects to be special and
    // which Spanish does not distinguish: zero takes the plural ("0 metros"),
    // and so does a fraction ("1,5 metros") — unlike Ukrainian, where 1,5 is a
    // genitive singular.
    expect(form(0)).toBe("other");
    expect(form(2)).toBe("other");
    expect(form(1.5)).toBe("other");
    expect(form(21)).toBe("other");
    expect(form(100)).toBe("other");
    // CLDR gives `es` a third category, `many`, at exactly this count — it is
    // the compact-notation row ("1 millón"), and `es.ts` folds it into `other`
    // on purpose. This is the assertion that says so: `Intl` disagrees with the
    // language here, and the disagreement is deliberate.
    expect(new Intl.PluralRules("es").select(1_000_000)).toBe("many");
    expect(form(1_000_000)).toBe("other");
  });

  test("the slot is not an axis, and a count-free target still names a key", () => {
    // Spanish agrees for number and nothing else, so unlike Ukrainian and the
    // German of `third-language.test.ts` there is no case axis to add: the same
    // count gives the same key in every position. A language that added one
    // would need nothing upstream to change, which is the point of `selectForm`
    // returning an opaque string — but adding an axis this language does not use
    // would cost every translator a row that can never differ.
    for (const slot of ["bare", "after-number", "conversion-target"] as const) {
      expect(form(1, slot)).toBe("one");
      expect(form(3, slot)).toBe("other");
    }
    // Ruling R5: a conversion target has no magnitude to agree with, and every
    // language must still answer. "en metros" is the plural, as it is in English.
    expect(
      spanish.selectForm({ kind: "length", unit: "m", slot: "conversion-target" }),
    ).toBe("other");
  });

  test("no count or slot reaches a third key", () => {
    const keys = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"] as const) {
      keys.add(spanish.selectForm({ kind: "length", unit: "m", slot }));
      for (const n of [0, 0.5, 1, 1.5, 2, 3, 5, 11, 21, 100, 1000, 1e6, 2e6, 1e12]) {
        keys.add(
          spanish.selectForm({ count: new Decimal(n), kind: "length", unit: "m", slot }),
        );
      }
    }
    expect([...keys].sort()).toEqual(["one", "other"]);
  });
});

describe("cardinals read", () => {
  test.each([
    // The fused ranges, which are single words and not compositions.
    ["quince", 15, 1],
    ["dieciséis", 16, 1],
    ["veintiuno", 21, 1],
    ["veintidós", 22, 1],
    // The composed range, where "y" is a connector and is claimed as part of the
    // numeral rather than left for the parser to trip over.
    ["treinta y uno", 31, 3],
    ["cuarenta y cinco", 45, 3],
    // Hundreds are addends: "doscientos cinco" is 200 + 5, with no "y" and no
    // multiplication anywhere in it.
    ["ciento cinco", 105, 2],
    ["doscientos cinco", 205, 2],
    ["novecientos noventa y nueve", 999, 4],
    // The scales, where the multiplication does live.
    ["mil", 1_000, 1],
    ["dos mil quinientos", 2_500, 3],
    ["cien mil", 100_000, 2],
    ["un millón", 1_000_000, 2],
    ["dos millones quinientos mil", 2_500_000, 4],
    ["un billón", 1_000_000_000_000, 2],
  ])("%s is %d", (words, value, consumed) => {
    expect(read(words)).toEqual({ value: new Decimal(value), consumed });
  });

  test.each([
    // A keyboard without accents, and the apocopated and feminine forms a
    // Spanish sentence actually contains. Every one is an extra key on a value
    // that already had one.
    ["dieciseis", 16],
    ["veintidos", 22],
    ["veintiun", 21],
    ["veintiuna", 21],
    ["una", 1],
    ["cien", 100],
    ["quinientas", 500],
    ["millon", 1_000_000],
  ])("%s also reads as %d", (word, value) => {
    expect(read(word)?.value).toEqual(new Decimal(value));
  });

  test("a connector is skipped, never claimed on its own", () => {
    // "y" advances the scan without advancing the claim, so a trailing one is
    // left for whatever follows the number.
    expect(read("cinco y")).toEqual({ value: new Decimal(5), consumed: 1 });
  });
});

describe("cardinals spell back through the same table", () => {
  test.each([
    [0, "cero"],
    // Apocope: the numeral stands immediately before the noun it counts, and
    // Spanish shortens it there. "un metro", never "uno metro".
    [1, "un"],
    [15, "quince"],
    [16, "dieciséis"],
    [21, "veintiún"],
    [22, "veintidós"],
    [31, "treinta y un"],
    [45, "cuarenta y cinco"],
    // "cien" alone, "ciento" with a remainder behind it — the same apocope, on
    // the hundreds word.
    [100, "cien"],
    [101, "ciento un"],
    [105, "ciento cinco"],
    [200, "doscientos"],
    [205, "doscientos cinco"],
    [500, "quinientos"],
    [999, "novecientos noventa y nueve"],
    // "mil" carries no multiplier at one, and the scale nouns do.
    [1_000, "mil"],
    [1_001, "mil un"],
    [2_000, "dos mil"],
    [21_000, "veintiún mil"],
    [100_000, "cien mil"],
    [101_000, "ciento un mil"],
    [1_000_000, "un millón"],
    [2_500_000, "dos millones quinientos mil"],
    [1_000_000_000_000, "un billón"],
  ])("%d spells as %s", (value, expected) => {
    expect(spell(value)).toBe(expected);
  });

  test.each([
    // The three cases `cardinalSpeller` declines, declined here for the same
    // reasons — see `spellSpanish`'s doc comment.
    [1.5],
    [-1],
    // A thousand billones. Spanish needs a scale above `billón` to say it, and
    // this table declares none, so it declines rather than composing a word
    // nobody writes.
    [1e15],
  ])("%p has no spelling", (value) => {
    expect(spell(value)).toBeNull();
  });

  /**
   * The round trip, which is the property the one shared `CARDINALS` object
   * exists to give: every string the writing direction produces is read back by
   * the reading direction as the number it started from, and with no word left
   * over.
   */
  test.each([
    0, 1, 7, 15, 16, 19, 20, 21, 29, 30, 31, 45, 99, 100, 101, 105, 200, 205, 500, 999,
    1_000, 1_001, 2_000, 21_000, 100_000, 101_000, 1_000_000, 2_500_000,
    1_000_000_000_000,
  ])("%d spells and reads back", (value) => {
    const written = spell(value);
    expect(written).not.toBeNull();
    const words = (written as string).split(" ");
    expect(read(written as string)).toEqual({
      value: new Decimal(value),
      consumed: words.length,
    });
  });

  test("every word the speller can emit is a word the table declares", () => {
    // The stricter half of the round trip: not "the sum comes back" but "each
    // individual word is in the table", which is what catches an apocopated form
    // that was written into the speller and never declared as a key. `veintiún`
    // is exactly that shape, and so is `cien`.
    const declared = new Set([
      ...Object.keys(CARDINALS.units),
      ...Object.keys(CARDINALS.tens),
      ...Object.keys(CARDINALS.scales),
      ...(CARDINALS.connectors ?? []),
    ]);
    const unknown = new Set<string>();
    for (let n = 0; n <= 1_200; n++) {
      for (const word of (spell(n) ?? "").split(" ")) {
        if (!declared.has(word)) unknown.add(word);
      }
    }
    for (const n of [21_000, 101_000, 1_000_000, 2_500_000, 1_000_000_000_000]) {
      for (const word of (spell(n) ?? "").split(" ")) {
        if (!declared.has(word)) unknown.add(word);
      }
    }
    expect([...unknown]).toEqual([]);
  });
});

/**
 * One finding, written as a test so that the day the helper grows to cover it
 * this row fails and is rewritten, rather than quietly staying true and telling
 * a reader the limit is still there. Same shape as
 * `third-language.test.ts`'s two German rows.
 */
test("cardinalNumerals cannot read a scale multiplied by another scale", () => {
  // 10⁹ has no word of its own in a long-scale language: Spanish says "mil
  // millones", a thousand of the previous scale. `cardinalNumerals` folds a run
  // of words left to right and settles each scale into its running total as it
  // passes, so it reads "mil" as a finished 1 000 and then "millones" as a fresh
  // multiplicand of 1 — a *wrong number*, not a refusal, which is why it is
  // pinned rather than described.
  const reader = cardinalNumerals(CARDINALS);
  expect(reader(["mil", "millones"])?.value.toString()).toBe("1001000");
  // The writing direction is not confused about it, which is what makes this a
  // reading limitation rather than a table one.
  expect(spell(1_000_000_000)).toBe("mil millones");
  // What does read: a multiplier that is not itself a scale word.
  expect(reader(["dos", "mil", "millones"])?.value.toString()).toBe("1002000");
});

/**
 * The language through a real engine, with a vocabulary built here rather than
 * shipped — the kinds' own Spanish vocabularies are other agents' work, and this
 * file must not wait on them to prove the mechanics.
 */
describe("spanish reads and writes through an engine", () => {
  const ES_LENGTH = defineVocabulary({
    locale: "es",
    kind: "length",
    units: {
      m: {
        aliases: ["m", "metro", "metros"],
        symbol: "m",
        forms: { one: "metro", other: "metros" },
      },
      km: {
        // Both spellings, for the reason the numerals table declares both: NFKC
        // does not strip the acute, so "kilometros" is a different string.
        aliases: ["km", "kilómetro", "kilómetros", "kilometro", "kilometros"],
        symbol: "km",
        forms: { one: "kilómetro", other: "kilómetros" },
      },
      cm: {
        aliases: ["cm", "centímetro", "centímetros", "centimetro", "centimetros"],
        symbol: "cm",
        forms: { one: "centímetro", other: "centímetros" },
      },
    },
  });

  const engine = createEngine({
    locales: [composeLocale(spanish, [ES_LENGTH])],
    kinds: BUILTIN_KINDS,
    format: "es",
  });

  test.each([
    // The plural axis, on a Spanish engine with no English installed beside it —
    // so the aliases are reached through this language's own `identity()`.
    ["1 kilómetro", "1 kilómetro"],
    ["3 kilómetros", "3 kilómetros"],
    ["0 metros", "0 metros"],
    // The decimal comma, read and written, and CLDR `other` at a fraction.
    ["1,5 kilómetros", "1,5 kilómetros"],
    // Both conversion keywords, and the engine's uniform grouping from the top
    // of this file — a full stop where English writes a comma.
    ["2 kilómetros en metros", "2.000 metros"],
    ["20 kilómetros a metros", "20.000 metros"],
    // The suffix stripper, on a plural the vocabulary happens to list and on the
    // accent-free spelling it also lists.
    ["5 kilometros", "5 kilómetros"],
    // Two words the vocabulary does not list at all, reached only by stripping
    // the plural off a listed singular.
    ["4 cm", "4 centímetros"],
  ])("%s evaluates to %s", (input, expected) => {
    expect(engine.evaluate(input).formatted).toBe(expected);
  });

  test("every string this vocabulary can print reads back", () => {
    // P3's lesson, applied before a shipped Spanish vocabulary can repeat it: a
    // vocabulary is correct not because its aliases resolve but because every
    // string it can *print* reads back as the same unit.
    const problems: string[] = [];
    for (const [unit, words] of Object.entries(ES_LENGTH.units)) {
      for (const printed of [...Object.values(words.forms ?? {}), words.symbol]) {
        if (printed === undefined) continue;
        const back = engine.evaluate(`3 ${printed}`);
        if (back.value.unit !== unit) {
          problems.push(`${unit}: ${printed} read back as ${back.value.unit}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

/**
 * Gender, which is the one axis Spanish has that `selectForm` does not carry.
 *
 * A unit noun does not inflect for gender — it *has* one — so `forms` is right
 * to stay a two-row table (rule 6: an axis that is never selected on must not be
 * declared). What does inflect is the numeral standing in front of it, and the
 * only call that sees the spelled numeral and the noun at the same time is
 * `renderQuantity`. These rows are the proof that the seam is enough: no shared
 * type changed, no other language moved, and "un pulgada" became "una pulgada".
 */
describe("the numeral agrees in gender with the noun it counts", () => {
  const render = (number: string, form: string) =>
    spanish.renderQuantity?.({
      number,
      form,
      kind: "length",
      unit: "m",
      slot: "after-number",
      gap: " ",
    });

  test.each([
    // Feminine nouns: the three shapes that inflect, and only those.
    ["un", "pulgada", "una pulgada"],
    ["un", "hora", "una hora"],
    ["veintiún", "pulgadas", "veintiuna pulgadas"],
    ["treinta y un", "millas", "treinta y una millas"],
    ["ciento un", "libras", "ciento una libras"],
    ["doscientos", "millas", "doscientas millas"],
    ["quinientos", "millas", "quinientas millas"],
    ["novecientos noventa y nueve", "toneladas", "novecientas noventa y nueve toneladas"],
    // Masculine nouns are left exactly as `spellSpanish` wrote them.
    ["un", "metro", "un metro"],
    ["veintiún", "metros", "veintiún metros"],
    ["doscientos", "kilómetros", "doscientos kilómetros"],
    // The invariable numerals, which have no feminine to move to in either
    // gender: only `uno` and the hundreds from 200 up agree at all.
    ["dos", "millas", "dos millas"],
    ["cien", "millas", "cien millas"],
    ["quince", "horas", "quince horas"],
    // `día` is masculine despite the -a, and nothing else in the repo is. It is
    // the single exception the morphological rule cannot derive — "caloría"
    // ends the same way and is feminine.
    ["un", "día", "un día"],
    ["veintiún", "días", "veintiún días"],
    ["un", "caloría", "una caloría"],
  ])("%s + %s -> %s", (number, form, expected) => {
    expect(render(number, form)).toBe(expected);
  });

  test.each([
    // `millón` and `billón` are masculine nouns, so what counts *them* stays
    // masculine while what counts the unit agrees. `mil` is not a noun and
    // agreement passes straight through it — which is the whole reason the
    // rewrite works on the tail after the last scale noun rather than on the
    // last word.
    ["doscientos mil", "millas", "doscientas mil millas"],
    // Masculine, because the hundreds here count `millones` and not `millas`.
    ["doscientos millones", "millas", "doscientos millones millas"],
    ["dos millones quinientos mil", "libras", "dos millones quinientas mil libras"],
    ["mil un", "millas", "mil una millas"],
  ])("%s + %s -> %s", (number, form, expected) => {
    expect(render(number, form)).toBe(expected);
  });

  test.each([
    // A scale noun in final position gets NO "de" before the unit, and that is
    // the one place this file prints something Spanish would not: "un millón de
    // millas" is the language's construction, and "de" is `keywords.of`, so the
    // engine reads that string back as `1000000 of millas` and throws. The rule
    // that wins is the printer's — emit only what the parser reads — and
    // `renderSpanishQuantity`'s doc comment carries the argument. These rows
    // pin the apposition so that re-adding the preposition fails here rather
    // than at a user.
    ["un millón", "millas", "un millón millas"],
    ["dos millones", "metros", "dos millones metros"],
    ["un billón", "libras", "un billón libras"],
    ["un millón quinientos mil", "millas", "un millón quinientas mil millas"],
    ["dos mil", "metros", "dos mil metros"],
    ["mil", "millas", "mil millas"],
  ])("%s + %s -> %s", (number, form, expected) => {
    expect(render(number, form)).toBe(expected);
  });

  /**
   * The property those rows exist to protect, stated once and generally: a
   * numeral this language *writes* may never contain a word this language
   * *reads as an operator*. The lexer consults one keyword table before any
   * alias index, so a connective smuggled into a spelled magnitude does not
   * degrade — it re-parses as arithmetic over the wrong operands. "de" was the
   * one that got in; "y" is the near miss that is fine, because `CARDINALS`
   * declares it as a connector and `keywords` deliberately does not claim it.
   */
  test("no spelled numeral contains one of this language's keywords", () => {
    const keywords = new Set(Object.values(spanish.keywords).flat());
    const nouns = ["metros", "millas", "libras", "días"];
    for (let n = 0; n <= 130; n++) {
      for (const noun of nouns) {
        const spelled = spell(n);
        if (spelled === undefined || spelled === null) continue;
        const rendered = spanish.renderQuantity?.({
          number: spelled,
          form: noun,
          kind: "length",
          unit: "m",
          slot: "after-number",
          gap: " ",
        });
        for (const word of (rendered ?? "").split(" ").slice(0, -1)) {
          expect(keywords.has(word), `${n} + ${noun} -> ${rendered}`).toBe(false);
        }
      }
    }
    for (const n of [1e3, 1e5, 1e6, 1.5e6, 2e6, 1e9, 1e12, 123456789]) {
      for (const noun of nouns) {
        const spelled = spell(n);
        if (spelled === undefined || spelled === null) continue;
        const rendered = spanish.renderQuantity?.({
          number: spelled,
          form: noun,
          kind: "length",
          unit: "m",
          slot: "after-number",
          gap: " ",
        });
        for (const word of (rendered ?? "").split(" ").slice(0, -1)) {
          expect(keywords.has(word), `${n} + ${noun} -> ${rendered}`).toBe(false);
        }
      }
    }
  });

  test("a digit string and a symbol label are both untouched", () => {
    // The ordinary path. Digits contain no numeral word to rewrite, and a label
    // that is a symbol or a bare alias is not a noun whose gender could be read
    // — so `formatValue`'s output is unchanged byte for byte by this addition.
    expect(render("1", "pulgada")).toBe("1 pulgada");
    expect(render("1,5", "millas")).toBe("1,5 millas");
    expect(
      spanish.renderQuantity?.({
        number: "un",
        symbol: "kg",
        kind: "mass",
        unit: "kg",
        slot: "after-number",
      }),
    ).toBe("un kg");
  });

  test("every feminine spelling it can emit is one the numeral table reads", () => {
    // The same guarantee the masculine spellings already have, and the reason
    // the rewrite may only produce words `CARDINALS` declares: a printed form
    // has to read back as the number it came from, in either gender.
    const read = cardinalNumerals(CARDINALS);
    const pairs: [string, string][] = [
      ["un", "una"],
      ["veintiún", "veintiuna"],
      ["doscientos", "doscientas"],
      ["trescientos", "trescientas"],
      ["cuatrocientos", "cuatrocientas"],
      ["quinientos", "quinientas"],
      ["seiscientos", "seiscientas"],
      ["setecientos", "setecientas"],
      ["ochocientos", "ochocientas"],
      ["novecientos", "novecientas"],
    ];
    for (const [masculine, feminine] of pairs) {
      expect(read([feminine])?.value).toEqual(
        read([masculine])?.value as unknown as Decimal,
      );
    }
  });
});

test("claims its conversion and arithmetic keywords", () => {
  expect(spanish.keywords.in).toEqual(["en", "a"]);
  expect(spanish.keywords.plus).toContain("más");
  // Without the acute too: NFKC leaves a precomposed á alone.
  expect(spanish.keywords.plus).toContain("mas");
  expect(spanish.keywords.times).toEqual(["por"]);
  expect(spanish.keywords.over).toEqual(["entre"]);
  // Deliberately absent: "por" is the connective after both participles, and it
  // is already the multiplication operator itself.
  expect(spanish.keywords.by).toBeUndefined();
});
