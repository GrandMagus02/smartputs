import { describe, expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { Decimal } from "../decimal";
import { createEngine } from "../engine";
import type { Slot } from "../types";
import { createAnalyzerChain } from "./analyze";
import { composeLocale } from "./compose";
import { numberSymbols } from "./number";
import { turkish } from "./tr";
import { CARDINALS } from "./tr-cardinals";
import { defineVocabulary } from "./vocabulary";

const form = (n: number, slot: Slot = "bare") =>
  turkish.selectForm({ count: new Decimal(n), kind: "length", unit: "m", slot });

const read = (...words: string[]) => turkish.numerals?.(words);
const spell = (n: number) => turkish.spell?.(new Decimal(n));

describe("turkish", () => {
  test("the key set is exactly one key, and it is `other`", () => {
    expect(turkish.id).toBe("tr");

    // The contract three later vocabularies key their `forms` tables off. Swept
    // over every count that could plausibly move a plural category and every
    // slot the printer can pass, including the count-free conversion target
    // ruling R5 exists for — one key comes back from all of them.
    const keys = new Set<string>();
    for (const slot of ["bare", "after-number", "conversion-target"] as Slot[]) {
      for (const n of [0, 1, 1.5, 2, 5, 11, 21, 100, 1_000_000]) keys.add(form(n, slot));
      keys.add(turkish.selectForm({ kind: "length", unit: "m", slot }));
      // A different kind and unit, so the key cannot be a function of those
      // either.
      keys.add(turkish.selectForm({ kind: "mass", unit: "kg", slot }));
    }
    expect([...keys]).toEqual(["other"]);
  });

  test("CLDR declares two categories and Turkish uses neither", () => {
    // Not a contradiction — CLDR describes the language, not this engine's
    // question. Turkish leaves a counted noun bare ("5 kilogram", never "5
    // kilogramlar"), so routing `selectForm` through these two would produce a
    // table whose rows must always hold the same string.
    expect(new Intl.PluralRules("tr").resolvedOptions().pluralCategories.sort()).toEqual([
      "one",
      "other",
    ]);
    expect(new Intl.PluralRules("tr").select(1)).toBe("one");
    expect(form(1)).toBe("other");
  });

  test("takes its number symbols from CLDR", () => {
    // Both visible ASCII characters on this runtime, so unlike Ukrainian's
    // U+00A0 group separator neither needs a \u escape to survive being
    // retyped — but the pin is here for the same reason Ukrainian's is: the
    // "intl" branch is a promise about the platform's output, and a platform
    // whose output moved would otherwise move every Turkish number silently.
    expect(numberSymbols(turkish)).toEqual({ group: ".", decimal: "," });
  });

  test("does not segment, because Turkish spaces its words", () => {
    // `segment` is for scripts written without spaces. Turkish is Latin and
    // spaced; what it agglutinates is suffixes *inside* a word, which is the
    // analyzer chain's business and not the lexer's.
    expect(turkish.segment).toBeUndefined();
  });
});

describe("keywords", () => {
  test("the conversion keyword is a verb, because the real marker is a suffix", () => {
    // Turkish marks a conversion target with the dative ending — "grama çevir"
    // — and a suffix is not a token. "çevir" is the verb it hangs off; "cevir"
    // is the same word off an ASCII keyboard; "to" is English's word under the
    // same `Keyword`, which `buildKeywords` folds rather than refuses.
    expect(turkish.keywords.in).toContain("çevir");
    expect(turkish.keywords.in).toContain("cevir");
    expect(turkish.keywords.in).toContain("to");
  });

  test("the arithmetic words carry both spellings", () => {
    expect(turkish.keywords.plus).toContain("artı");
    expect(turkish.keywords.plus).toContain("arti");
    expect(turkish.keywords.minus).toContain("eksi");
    expect(turkish.keywords.times).toContain("çarpı");
    expect(turkish.keywords.times).toContain("carpi");
    expect(turkish.keywords.over).toContain("bölü");
    expect(turkish.keywords.over).toContain("bolu");
  });

  test("every listed word survives caps lock on both keyboards", () => {
    // The half an exact-array assertion could not see, and the reason those two
    // are now written with `toContain`. A keyword is matched on **one** fold of
    // the token — `lex` calls `toLocaleLowerCase(locale.id)` and looks the
    // result up in the map `buildKeywords` built by folding these same surfaces
    // — with no analyzer between the two. So under `tr` an ASCII keyboard's
    // "CEVIR" arrives as "cevır" with a dotless ı, and the diacritic-free
    // spelling this table lists for exactly that keyboard was reachable in
    // lowercase and unreachable in capitals. `capsFolds` closes it; this is the
    // property, asserted over the whole table rather than over the four words
    // that happen to need it today.
    const listed = new Set<string>();
    for (const words of Object.values(turkish.keywords)) {
      for (const word of words ?? []) listed.add(word.toLocaleLowerCase("tr"));
    }
    for (const [keyword, words] of Object.entries(turkish.keywords)) {
      for (const word of words ?? []) {
        // Both keyboards' idea of capitals: `toLocaleUpperCase("tr")` sends i to
        // İ, and the locale-neutral `toUpperCase()` sends it to I.
        for (const caps of [word.toLocaleUpperCase("tr"), word.toUpperCase()]) {
          expect(
            listed.has(caps.toLocaleLowerCase("tr")),
            `${keyword} ${JSON.stringify(word)} typed as ${JSON.stringify(caps)}`,
          ).toBe(true);
        }
      }
    }
  });

  test("of, off and by are claimed by nothing, and each absence is a decision", () => {
    // `of` and `off` are suffixes in this language ("50'nin %20'si", "50
    // liradan %20 indirim"), so there is no free token to claim. `by` has
    // nothing to do: "bölü" is already a whole operator, unlike English's
    // "divided by", so no particle is left over for `foldWordOps` to swallow.
    expect(turkish.keywords.of).toBeUndefined();
    expect(turkish.keywords.off).toBeUndefined();
    expect(turkish.keywords.by).toBeUndefined();
  });

  test("no surface word is claimed for two different keywords", () => {
    // The check `buildKeywords` would make at boot, made here on one language
    // alone so a conflict inside this table is a Turkish test failure rather
    // than an engine one.
    const seen = new Map<string, string>();
    for (const [keyword, words] of Object.entries(turkish.keywords)) {
      for (const word of words ?? []) {
        expect(seen.get(word) ?? keyword).toBe(keyword);
        seen.set(word, keyword);
      }
    }
  });
});

/**
 * Turkish numerals are the most regular this repo has met: space-separated
 * words, largest first, no infix, no connective, no irregular teens. That is
 * exactly the model `NumeralParser` was cut for, which is why the *shared*
 * `cardinalNumerals` reads them and only the writing direction needed a
 * language of its own.
 */
describe("turkish reads cardinals through the shared fold", () => {
  test.each([
    [["sıfır"], 0],
    [["bir"], 1],
    [["dokuz"], 9],
    // The teens, composed rather than declared: ten plus a unit, two words.
    [["on"], 10],
    [["on", "bir"], 11],
    [["on", "dokuz"], 19],
    [["yirmi", "iki"], 22],
    [["kırk", "beş"], 45],
    [["doksan", "dokuz"], 99],
    // "yüz" multiplies what precedes it and counts itself when nothing does.
    [["yüz"], 100],
    [["yüz", "beş"], 105],
    [["iki", "yüz"], 200],
    [["üç", "yüz", "kırk", "beş"], 345],
    [["bin"], 1000],
    [["bin", "beş", "yüz"], 1500],
    [["iki", "bin"], 2000],
    [["yüz", "bin"], 100_000],
    [["bir", "milyon"], 1_000_000],
    [["iki", "milyon", "beş", "yüz", "bin"], 2_500_000],
    [["bir", "milyar"], 1_000_000_000],
  ])("%p is %d", (words, value) => {
    expect(read(...words)).toEqual({ value: new Decimal(value), consumed: words.length });
  });

  test("the ASCII spellings read as the same numbers", () => {
    // A Turkish keyboard has ü, ç, ş and ı; a hurried typist does not always
    // reach for them. Each plain-letter spelling is a second key on the same
    // value.
    expect(read("uc")?.value.toString()).toBe("3");
    expect(read("bes", "yuz")?.value.toString()).toBe("500");
    expect(read("kirk", "alti")?.value.toString()).toBe("46");
  });

  test("an all-caps numeral reads through the ASCII key and not the Turkish one", () => {
    // `cardinalNumerals` folds an incoming word with the locale-neutral
    // `toLowerCase()`, so "SIFIR" — the correct all-caps spelling of "sıfır" —
    // arrives as "sifir" and never as "sıfır". The dotless ı is unreachable
    // through that fold, and the ASCII key is what catches it. This is the same
    // hazard `caseFolds` deals with on the unit-word side.
    expect("SIFIR".toLowerCase()).toBe("sifir");
    expect("SIFIR".toLocaleLowerCase("tr")).toBe("sıfır");
    expect(read("SIFIR")?.value.toString()).toBe("0");
    expect(read("BES")?.value.toString()).toBe("5");
  });

  test("and where the ASCII key is not enough, the Turkish fold is", () => {
    // The half the ASCII key above cannot reach, and the reason `numerals` is
    // `turkishNumerals()` rather than the bare shared helper.
    //
    // Two shapes fall outside it, and both are ordinary Turkish rather than an
    // edge case. `"BİR".toLowerCase()` is *not* "bir": locale-neutrally the
    // dotted capital becomes "i" followed by U+0307 COMBINING DOT ABOVE, which
    // is a key in no table anywhere — so every numeral with an i in it was
    // unreadable in capitals. And `"ALTMIŞ".toLowerCase()` is "altmiş" with a
    // dotted i where the word has a dotless one; the ASCII key beside it is
    // "altmis" with a plain s, so it catches "ALTMIS" and not "ALTMIŞ".
    expect("BİR".toLowerCase()).not.toBe("bir");
    expect("ALTMIŞ".toLowerCase()).toBe("altmiş");

    expect(read("BİR")?.value.toString()).toBe("1");
    expect(read("İKİ")?.value.toString()).toBe("2");
    expect(read("MİLYON")?.value.toString()).toBe("1000000");
    expect(read("ALTMIŞ")?.value.toString()).toBe("60");
    expect(read("YİRMİ", "İKİ")?.value.toString()).toBe("22");
    expect(read("BİN", "BEŞ", "YÜZ")?.value.toString()).toBe("1500");
  });

  test("the Turkish fold is a second attempt and never a replacement", () => {
    // Why the words as typed are tried first: an ASCII keyboard's "BIR" reads
    // through the locale-neutral fold to "bir", where the Turkish fold sends it
    // to "bır" and finds nothing. A single Turkish-only fold would have traded
    // one keyboard's capitals for the other's.
    expect(read("BIR")?.value.toString()).toBe("1");
    expect(read("IKI")?.value.toString()).toBe("2");
    expect(read("MILYON")?.value.toString()).toBe("1000000");
    // And a run the first pass finishes is never re-read: the claim stops in
    // the same place either way.
    expect(read("yirmi", "iki", "metre")).toEqual({
      value: new Decimal(22),
      consumed: 2,
    });
    expect(read("YİRMİ", "İKİ", "METRE")?.consumed).toBe(2);
  });

  test("a claim stops where the numerals stop", () => {
    expect(read("yirmi", "iki", "metre")).toEqual({
      value: new Decimal(22),
      consumed: 2,
    });
    expect(read("metre")).toBeNull();
    // "ve" is the ordinary conjunction and is deliberately not a connector, so
    // it ends the claim instead of being skipped: Turkish writes "yüz beş", and
    // a numeral that swallowed "ve" would eat the "and" out of unrelated prose.
    expect(read("yüz", "ve", "beş")).toEqual({ value: new Decimal(100), consumed: 1 });
  });

  test("the table declares no connectors and no teens", () => {
    expect(CARDINALS.connectors).toBeUndefined();
    // 11–19 are composed by both directions from `on` plus a unit; a declared
    // "onbir" would be a word no run can ever hold.
    expect(Object.values(CARDINALS.units).some((v) => v > 10)).toBe(false);
  });
});

describe("turkish spells back through the same table", () => {
  test.each([
    [0, "sıfır"],
    [1, "bir"],
    [9, "dokuz"],
    [10, "on"],
    [11, "on bir"],
    [22, "yirmi iki"],
    [45, "kırk beş"],
    [99, "doksan dokuz"],
    // The two rows the shared `cardinalSpeller` gets wrong: it composes every
    // scale as `<multiplier> <scale>` and would write "bir yüz" and "bir bin",
    // which are the two commonest round numbers in the language and both
    // mistakes.
    [100, "yüz"],
    [1000, "bin"],
    [105, "yüz beş"],
    [200, "iki yüz"],
    [345, "üç yüz kırk beş"],
    [1500, "bin beş yüz"],
    [2000, "iki bin"],
    [100_000, "yüz bin"],
    [345_678, "üç yüz kırk beş bin altı yüz yetmiş sekiz"],
    // …and the row that shows the asymmetry is the language rather than a
    // simplification: "bin" counts itself, "milyon" does not. "bin" and "yüz"
    // are numerals; "milyon" and "milyar" are borrowed nouns that need
    // something to count them.
    [1_000_000, "bir milyon"],
    [2_500_000, "iki milyon beş yüz bin"],
    [1_000_000_000, "bir milyar"],
  ])("%d spells as %s", (value, expected) => {
    expect(spell(value)).toBe(expected);
  });

  test("the diacritics are written, never the ASCII fallback", () => {
    // Both spellings are declared for reading; the correct one is declared
    // first, and both reverse maps keep the first word they see for a value.
    expect(spell(3)).toBe("üç");
    expect(spell(40)).toBe("kırk");
    expect(spell(500)).toBe("beş yüz");
  });

  test("declines exactly where the tables run out", () => {
    // The same three refusals `cardinalSpeller` documents: no fractional
    // grammar in the tables, no sign in the numeral fold, and nothing at or
    // above 1000 x the largest declared scale.
    expect(spell(1.5)).toBeNull();
    expect(spell(-1)).toBeNull();
    expect(spell(1e15)).toBeNull();
  });

  test("every spelling round-trips through the parser", () => {
    // The property the one-table-two-directions layout exists to guarantee, run
    // over a spread wide enough to reach every branch of both directions.
    const sample = [
      0, 1, 2, 9, 10, 11, 15, 19, 20, 22, 45, 70, 99, 100, 101, 105, 200, 345, 999, 1000,
      1001, 1500, 2000, 10_000, 100_000, 345_678, 999_999, 1_000_000, 2_500_000,
      1_000_000_000, 1_000_000_000_000,
    ];
    const problems: string[] = [];
    for (const n of sample) {
      const written = spell(n);
      if (written === null || written === undefined) {
        problems.push(`${n} does not spell`);
        continue;
      }
      const back = read(...written.split(" "));
      if (back === null || back === undefined || !back.value.equals(n)) {
        problems.push(`${n} spelled "${written}" and read back as ${back?.value}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

/**
 * The analyzer chain, where both of the things Turkish stresses live: vowel
 * harmony enumerated as a flat suffix list, and the four-letter i.
 *
 * Asserted on the chain rather than through an engine because a `Language` ships
 * no words — what a stem *resolves to* is the alias index's business, built from
 * vocabularies this file has never seen. What is Turkish's own business is which
 * forms the chain offers and at what weight.
 */
describe("the analyzer chain", () => {
  const analyze = createAnalyzerChain(turkish);
  const forms = (surface: string) => analyze(surface).map((a) => a.form);
  const weightOf = (surface: string, form: string) =>
    analyze(surface).find((a) => a.form === form)?.weight;

  test("identity offers the word as typed", () => {
    // Load-bearing: `createResolver` looks a surface up only through the forms
    // some analyzer produced, so without this the language cannot reach its own
    // aliases at all.
    expect(forms("metre")).toContain("metre");
    expect(weightOf("metre", "metre")).toBe(0);
    // The stripper fires on it too — "metre" ends in the dative -e — and the
    // useless stem it produces sits behind the exact form at a penalty rather
    // than instead of it. Nothing resolves "metr", so it costs a map entry.
    expect(weightOf("metre", "metr")).toBe(-2);
  });

  test.each([
    // Dative, both harmonic shapes, and the -y- buffer after a vowel-final stem.
    ["kilograma", "kilogram"],
    ["metreye", "metre"],
    // Locative, both shapes.
    ["kilogramda", "kilogram"],
    ["metrede", "metre"],
    // Locative hardened to -t- after a voiceless consonant.
    ["saatte", "saat"],
    // Ablative, all four shapes the pair of alternations produces.
    ["kilogramdan", "kilogram"],
    ["metreden", "metre"],
    // Accusative, four-way, with and without the buffer.
    ["kilogramı", "kilogram"],
    ["metreyi", "metre"],
    ["gramı", "gram"],
    // Genitive, with the -n- buffer.
    ["metrenin", "metre"],
    ["kilogramın", "kilogram"],
    // Plural, and plural plus case.
    ["kilogramlar", "kilogram"],
    ["metreler", "metre"],
    ["metrelere", "metre"],
    ["metrelerden", "metre"],
    ["kilogramları", "kilogram"],
  ])("%s strips back to %s", (surface, stem) => {
    expect(forms(surface)).toContain(stem);
    // Penalised, so an exact alias always outranks a stripped one.
    expect(weightOf(surface, stem)).toBe(-2);
  });

  test("harmony is enumerated, not derived — both halves of each pair strip", () => {
    // The one property a flat list has to be checked for: a suffix written in
    // only one of its two or four harmonic shapes silently half-works, reading
    // the front-vowel words and refusing the back-vowel ones. Each pair here is
    // the same case ending on stems of opposite harmony.
    for (const [front, back] of [
      ["metreye", "kilograma"],
      ["metrede", "kilogramda"],
      ["metreden", "kilogramdan"],
      ["metreyi", "kilogramı"],
      ["metrenin", "kilogramın"],
      ["metreler", "kilogramlar"],
    ]) {
      expect(forms(front as string).length).toBeGreaterThan(1);
      expect(forms(back as string).length).toBeGreaterThan(1);
    }
  });

  test("minStem keeps short symbols whole", () => {
    // Two letters are safe at any floor above 1 — a strip leaves at most one
    // letter — and these are here so a future edit to the floor has to notice
    // them.
    expect(forms("kg")).toEqual(["kg"]);
    expect(forms("cm")).toEqual(["cm"]);
    // The rows that actually decide the floor. Six of the suffixes are a single
    // vowel, so a three-letter symbol ending in one is the real hazard: at a
    // floor of 2 "kva" strips to "kv", which is the folded symbol for a
    // kilovolt, and an apparent-power unit reads as a voltage.
    expect(forms("psi")).toEqual(["psi"]);
    expect(forms("kva")).toEqual(["kva"]);
    // Short Turkish words that would otherwise be shredded to a single letter:
    // "gün" ends in the genitive -ün, "bin" in the genitive -in.
    expect(forms("gün")).toEqual(["gün"]);
    expect(forms("bin")).toEqual(["bin"]);
  });

  /**
   * The other half of Turkish agglutination: a suffix on an abbreviation is
   * written after an apostrophe, and the bare list cannot see it.
   *
   * The floor that keeps a symbol whole above is exactly what made these
   * unreachable — "kg'a" strips its `-a` to leave "kg'", a string the alias index
   * has never held — so `APOSTROPHE_STRIPPER` runs the same list again behind
   * each apostrophe at `minStem: 1`. The low floor is safe there and only there,
   * because no Turkish stem contains an apostrophe.
   */
  test.each([
    // Dative on a two- and a one-letter symbol, both harmonic shapes, with and
    // without the -y- buffer the abbreviation's spoken form takes.
    ["kg'a", "kg"],
    ["km'ye", "km"],
    ["m'ye", "m"],
    // Locative, hardened after the voiceless consonant "saat" is read as.
    ["sa'te", "sa"],
    ["gb'da", "gb"],
    // Ablative and accusative.
    ["kg'dan", "kg"],
    ["gb'ı", "gb"],
    // A spelled noun apostrophized anyway, which Turkish does for a proper name:
    // the zone words in `@smartput/datetime/locale/tr` are all of this shape.
    ["japonya'da", "japonya"],
    ["tokyo'ya", "tokyo"],
  ])("%s strips back to %s", (surface, stem) => {
    expect(forms(surface)).toContain(stem);
    expect(weightOf(surface, stem)).toBe(-2);
  });

  test("all three apostrophes, because lex accepts three and NFKC folds none", () => {
    // U+0027 from a plain keyboard, U+2019 from a word processor, U+02BC from
    // the standards that prescribe a letter-apostrophe. `isInnerApostrophe`
    // enumerates the same three.
    for (const mark of ["'", "’", "ʼ"]) {
      expect(forms(`kg${mark}a`)).toContain("kg");
    }
  });

  test("the apostrophe floor cannot shred a word that has no apostrophe", () => {
    // The guard on the low floor: this stripper fires only on a surface that
    // already announced a suffix boundary, so the two-letter symbols above are
    // untouched by it and so is every ordinary word.
    expect(forms("kg")).toEqual(["kg"]);
    expect(forms("m")).toEqual(["m"]);
    expect(forms("gram")).toEqual(["gram"]);
  });

  test("case and the apostrophe compose, which is the shape an abbreviation has", () => {
    // An abbreviation is the one word class Turkish writes in capitals *and*
    // suffixes with an apostrophe, so "GB'I" needs the fold and the strip at
    // once. The dotless I is what a Turkish keyboard produces for the
    // accusative of a back-vowel stem, so the unpenalised Turkish fold reaches
    // it and the ASCII pass is not needed here.
    expect(forms("GB'I")).toContain("gb");
    expect(weightOf("GB'I", "gb")).toBe(-2);
    // And the other way round: the ASCII pass carries its own −1 on top.
    expect(forms("KG'A")).toContain("kg");
    expect(weightOf("KG'A", "kg")).toBe(-2);
  });

  test("the dotted and dotless i, which is the whole reason this chain is not a fold", () => {
    // The platform behaviour being worked around, pinned first so a reader can
    // see the hazard rather than take it on trust. These two lines are the only
    // place in this repo where a case fold depends on the language.
    expect("KILOGRAM".toLocaleLowerCase("tr")).toBe("kılogram");
    expect("KİLOGRAM".toLocaleLowerCase("tr")).toBe("kilogram");

    // A Turkish reader typing correct Turkish caps: İ is the capital of i, and
    // the fold that respects it is offered unpenalised.
    expect(forms("KİLOGRAM")).toContain("kilogram");
    expect(weightOf("KİLOGRAM", "kilogram")).toBe(0);

    // An ASCII keyboard typing the same word: I is Turkish's dotless capital,
    // so the language's own fold gives "kılogram" — which matches no alias —
    // and the ASCII fold is what reaches the word, at a penalty.
    expect(forms("KILOGRAM")).toContain("kılogram");
    expect(weightOf("KILOGRAM", "kılogram")).toBe(0);
    expect(forms("KILOGRAM")).toContain("kilogram");
    expect(weightOf("KILOGRAM", "kilogram")).toBe(-1);
  });

  test("no form carries the decomposed dotted i", () => {
    // `"İ".toLowerCase()` is not `"i"`: locale-neutrally it produces two code
    // points, an i followed by U+0307 COMBINING DOT ABOVE, which matches no
    // alias key anywhere. The character maps turn it into a plain i before that
    // can happen, and this is the assertion that would fail if the maps were
    // ever replaced by a bare `toLowerCase()`.
    expect("İ".toLowerCase()).toBe("i̇");
    for (const surface of ["İNÇ", "İki", "KİLOGRAM"]) {
      for (const f of forms(surface)) expect(f).not.toContain("̇");
    }
    expect(forms("İNÇ")).toContain("inç");
  });

  test("case and morphology compose, because the chain does not iterate", () => {
    // Every analyzer sees the same original surface, so a `-ya` taken off by
    // the stripper never reaches the folder and vice versa. `caseFolds` runs the
    // one shared suffix list over each folded variant for exactly this reason:
    // without it an all-caps inflected word — the way a heading is set — would
    // reach neither.
    expect(forms("KİLOGRAMA")).toContain("kilogram");
    expect(forms("METREYE")).toContain("metre");
    // The two penalties sum rather than replace each other: -2 for the strip on
    // top of -1 for the ASCII fold.
    expect(weightOf("KILOGRAMA", "kilogram")).toBe(-3);
  });

  test("a fold that changes nothing offers nothing", () => {
    // The common path: an already-lowercase word with no i-shaped letter gets
    // exactly what `identity()` and the stripper produced, and no duplicate.
    expect(forms("gram")).toEqual(["gram"]);
    expect(forms("metrede")).toEqual(["metrede", "metre", "metred"]);
  });
});

/**
 * The rulings as behaviour rather than as array contents.
 *
 * `LENGTH_FIXTURE` is a fixture, not a shipped vocabulary: Turkish's real words
 * for `length` belong to `@smartput/length/locale/tr`, and a `Language` may not
 * contain one. Three units are enough to write a sentence in.
 *
 * Note the `forms` tables: one row each, keyed `other`, which is the contract
 * `selectForm` states.
 */
describe("through a real engine", () => {
  const LENGTH_FIXTURE = defineVocabulary({
    locale: "tr",
    kind: "length",
    units: {
      m: { aliases: ["metre", "m"], symbol: "m", forms: { other: "metre" } },
      cm: {
        aliases: ["santimetre", "cm"],
        symbol: "cm",
        forms: { other: "santimetre" },
      },
      km: {
        aliases: ["kilometre", "km"],
        symbol: "km",
        forms: { other: "kilometre" },
      },
    },
  });
  const engine = createEngine({
    locales: [composeLocale(turkish, [LENGTH_FIXTURE])],
    kinds: BUILTIN_KINDS,
    format: "tr",
  });
  const evaluate = (input: string) => engine.evaluate(input).formatted;

  test.each([
    // The noun is bare after every count, which is the one-key contract seen
    // from the outside.
    ["1 metre", "1 metre"],
    ["5 metre", "5 metre"],
    ["0 metre", "0 metre"],
    // The decimal comma and the group separator, from `numberFormat: "intl"`.
    ["1,5 metre", "1,5 metre"],
    ["1 kilometre to metre", "1.000 metre"],
    // The conversion verb, in both spellings.
    ["1 kilometre çevir metre", "1.000 metre"],
    ["1 kilometre cevir metre", "1.000 metre"],
    // Inflected input, reached through the suffix list rather than the
    // vocabulary: neither of these is an alias above.
    ["10 metreye", "10 metre"],
    ["10 kilometreden", "10 kilometre"],
    ["10 santimetrede", "10 santimetre"],
    ["10 metreler", "10 metre"],
    // Turkish numerals, through the engine.
    ["yirmi iki metre", "22 metre"],
    ["iki bin metre", "2.000 metre"],
    // The apostrophe forms, which is how Turkish inflects an abbreviation. None
    // of these is an alias above either, and the bare suffix list cannot reach
    // them: "km'ye" ends in the dative -e, which strips to "km'y".
    ["10 km'ye", "10 kilometre"],
    ["10 cm'den", "10 santimetre"],
    ["10 m'yi", "10 metre"],
    ["1 km'yi çevir m", "1.000 metre"],
  ])("%s evaluates to %s", (input, expected) => {
    expect(evaluate(input)).toBe(expected);
  });

  test.each([
    ["10 metre artı 5 metre", "15 metre"],
    ["10 metre arti 5 metre", "15 metre"],
    ["10 metre eksi 2 metre", "8 metre"],
    ["10 metre çarpı 2", "20 metre"],
    ["10 metre carpi 2", "20 metre"],
    ["10 metre bölü 2", "5 metre"],
    ["10 metre bolu 2", "5 metre"],
  ])("%s evaluates to %s", (input, expected) => {
    expect(evaluate(input)).toBe(expected);
  });

  test.each([
    // Correct Turkish caps, folded by the language's own rule.
    ["10 KİLOMETRE", "10 kilometre"],
    ["10 Kilometre", "10 kilometre"],
    // An ASCII keyboard's caps, where the language's own rule gives "kılometre"
    // and only the penalised ASCII fold reaches the word. This row is the one
    // that fails the moment anything in the chain starts folding under a `tr`
    // tag.
    ["10 KILOMETRE", "10 kilometre"],
    // Caps and a case ending at once, which reaches the alias only because the
    // stripper is run over the folded variants.
    ["10 KİLOMETREYE", "10 kilometre"],
    ["10 KILOMETREYE", "10 kilometre"],
  ])("%s evaluates to %s", (input, expected) => {
    expect(evaluate(input)).toBe(expected);
  });

  test("a symbol is spaced, which is SI and not English's tight 5kg", () => {
    const render = (parts: Parameters<NonNullable<typeof turkish.renderQuantity>>[0]) =>
      turkish.renderQuantity?.(parts);
    const base = { number: "5", kind: "mass", unit: "kg", slot: "bare" as Slot };
    expect(render({ ...base, symbol: "kg" })).toBe("5 kg");
    // The word branch is untouched, and a caller's own gap still wins on both.
    expect(render({ ...base, form: "kilogram", symbol: "kg" })).toBe("5 kilogram");
    expect(render({ ...base, symbol: "kg", gap: "" })).toBe("5kg");
    // I10's graceful degradation, unchanged: a half-translated engine renders
    // awkwardly rather than throwing.
    expect(render(base)).toBe("5 kg");
  });
});
