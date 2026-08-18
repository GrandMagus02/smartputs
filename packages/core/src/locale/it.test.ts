import { describe, expect, test } from "bun:test";
import { Decimal } from "../decimal";
import type { Slot } from "../types";
import { createAnalyzerChain } from "./analyze";
import { italian } from "./it";
import { CARDINALS } from "./it-cardinals";
import { numberSymbols } from "./number";

const form = (n: number, slot: Slot = "bare") =>
  italian.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot });

const analyze = createAnalyzerChain(italian);
const forms = (surface: string) => analyze(surface).map((a) => a.form);

describe("italian", () => {
  /**
   * The contract three vocabularies will key their `forms` tables off, pinned
   * as the whole key set and not as a sample: `"one"` and `"other"`, and no
   * third key for any count or any slot.
   */
  test("keys are the CLDR category, with `many` folded into `other`", () => {
    expect(italian.id).toBe("it");
    expect(form(1)).toBe("one");
    expect(form(0)).toBe("other");
    expect(form(2)).toBe("other");
    expect(form(21)).toBe("other");
    expect(form(100)).toBe("other");
    // A fraction. Italian marks it like any other plural — "1,5 chilogrammi" —
    // unlike Ukrainian, where the same row is a genitive *singular*.
    expect(form(1.5)).toBe("other");
    // The fold that makes the key set two and not three, asserted against the
    // raw CLDR answer beside it so the collapse is visible rather than
    // implied: `many` exists for the compact "un milione di euro", which this
    // engine never prints.
    expect(new Intl.PluralRules("it").select(1_000_000)).toBe("many");
    expect(form(1_000_000)).toBe("other");
    // …and the value just off the exact million, which CLDR does not call
    // `many` at all. Both sides of the boundary answer the same key here.
    expect(form(1_500_000)).toBe("other");
  });

  test("the slot changes nothing, because Italian nouns do not decline", () => {
    // The row Ukrainian and German both use a second axis for. "in chilogrammi"
    // is the same word as "5 chilogrammi", so a vocabulary needs no case
    // column — and R5's count-free conversion target still names a key.
    expect(form(1, "conversion-target")).toBe("one");
    expect(form(5, "conversion-target")).toBe("other");
    expect(
      italian.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }),
    ).toBe("other");
    expect(form(5, "after-number")).toBe("other");
  });

  test("the whole key set is exactly two keys", () => {
    const slots: Slot[] = ["bare", "after-number", "conversion-target"];
    const counts = [0, 1, 1.5, 2, 5, 11, 21, 100, 1000, 1_000_000, 1_000_000_000];
    const keys = new Set<string>();
    for (const slot of slots) {
      keys.add(italian.selectForm({ kind: "mass", unit: "kg", slot }));
      for (const count of counts) keys.add(form(count, slot));
    }
    expect([...keys].sort()).toEqual(["one", "other"]);
  });

  test("takes its number symbols from CLDR", () => {
    // Both are visible characters here — Italian groups with a full stop and
    // marks the decimal with a comma, which is neither English's pair nor
    // Ukrainian's U+00A0 group — so there is nothing to write as an escape.
    expect(numberSymbols(italian)).toEqual({ group: ".", decimal: "," });
  });
});

describe("italian numerals", () => {
  const read = (...words: string[]) => italian.numerals?.(words);
  const spell = (n: number) => italian.spell?.(new Decimal(n));

  /**
   * The round trip, one row per shape the welded numeral can take. Read left to
   * right it is the parse direction; read right to left it is `spell`, and both
   * run against every row — which is the whole reason the tables and the two
   * sandhi rules live in one file.
   */
  test.each([
    [0, "zero"],
    [1, "uno"],
    [3, "tre"],
    [8, "otto"],
    [16, "sedici"],
    [20, "venti"],
    // Elision before *uno* and *otto*, the first sandhi rule.
    [21, "ventuno"],
    [28, "ventotto"],
    // The accent on final *tre*, the second.
    [23, "ventitré"],
    [22, "ventidue"],
    [48, "quarantotto"],
    [99, "novantanove"],
    [100, "cento"],
    // "cent" + "uno": the split greedy longest-match alone cannot find, which
    // is why `decompose` backtracks.
    [101, "centuno"],
    [103, "centotré"],
    [108, "centotto"],
    // …and the vowel-initial unit that does NOT elide, which is why the rule
    // is keyed on the value and not on the first letter of the tail.
    [111, "centoundici"],
    [200, "duecento"],
    [300, "trecento"],
    [999, "novecentonovantanove"],
    [1000, "mille"],
    // No elision across the thousands join.
    [1001, "milleuno"],
    [1500, "millecinquecento"],
    [2000, "duemila"],
    [2003, "duemilatré"],
    // The accent disappears again the moment "tre" stops being final.
    [23_000, "ventitremila"],
    [100_000, "centomila"],
    [999_999, "novecentonovantanovemilanovecentonovantanove"],
    // At a million the scale word detaches, and the multiplier of 1 is the
    // apocopated "un" — Italian never says "uno milione".
    [1_000_000, "un milione"],
    [2_500_000, "due milioni cinquecentomila"],
    [1_000_000_000, "un miliardo"],
  ])("%i is %s, in both directions", (value, words) => {
    // Split, because a detached scale noun is a second word and the fold is
    // handed a run: "due milioni cinquecentomila" is three tokens and one
    // number, and claiming all three is part of what is under test.
    const run = words.split(" ");
    expect(read(...run)).toEqual({ value: new Decimal(value), consumed: run.length });
    expect(spell(value)).toBe(words);
  });

  test("reads the spellings it does not write", () => {
    // The accent is optional on the way in: a keyboard that will not make "é"
    // is not a keyboard that should be refused.
    expect(read("ventitre")?.value).toEqual(new Decimal(23));
    // Un-elided, which plenty of writing uses and which the table reads because
    // "cento" and "uno" are both declared whole.
    expect(read("centouno")?.value).toEqual(new Decimal(101));
    // The three spellings of 1. "uno" stands alone, "un" goes before a noun and
    // "una" before a feminine one; the speller writes only the first two.
    expect(read("un")?.value).toEqual(new Decimal(1));
    expect(read("una")?.value).toEqual(new Decimal(1));
    expect(read("cinquantuna")?.value).toEqual(new Decimal(51));
    // A bare scale noun is one of it, the same implicit multiplier
    // `cardinalNumerals` gives a bare "hundred".
    expect(read("milioni")?.value).toEqual(new Decimal(1_000_000));
    expect(read("mila")?.value).toEqual(new Decimal(1000));
  });

  test("claims a prefix of a run and stops", () => {
    // "cinque" is claimed, "metri" is not, and the unit word survives to be
    // resolved as a unit.
    expect(read("cinque", "metri")).toEqual({ value: new Decimal(5), consumed: 1 });
    // Three words, two shapes: a welded multiplier, a detached scale noun and a
    // welded remainder.
    expect(read("due", "milioni", "cinquecentomila")).toEqual({
      value: new Decimal(2_500_000),
      consumed: 3,
    });
    // Nothing at all is null, never a zero-length claim.
    expect(read("chilogrammi")).toBeNull();
  });

  /**
   * The failure mode a welded-numeral reader has and a spaced one does not:
   * `foldNumerals` replaces a word token with a *number* token, so a unit noun
   * that decomposed would be destroyed before any vocabulary saw it. Every one
   * of these begins the way some numeral does — "centimetro" starts "cent",
   * "settimana" starts "sett", "unità" starts "un", "millimetro" starts
   * "milli" — and every one is refused, because `decompose` must consume the
   * *whole* token and none of these leaves a readable remainder.
   */
  test.each([
    "metro",
    "metri",
    "centimetro",
    "centimetri",
    "millimetro",
    "millilitro",
    "chilometro",
    "chilogrammo",
    "chilogrammi",
    "grammo",
    "grammi",
    "tonnellata",
    "tonnellate",
    "litro",
    "litri",
    "secondo",
    "secondi",
    "minuto",
    "minuti",
    "ora",
    "ore",
    "giorno",
    "settimana",
    "miglio",
    "miglia",
    "pollice",
    "pollici",
    "piede",
    "piedi",
    "oncia",
    "once",
    "libbra",
    "libbre",
    "nodo",
    "nodi",
    "grado",
    "gradi",
    "ettaro",
    "quintale",
    "unità",
    "watt",
    "euro",
    "byte",
  ])("%s is a noun and not a numeral", (word) => {
    expect(italian.numerals?.([word])).toBeNull();
  });

  test("declines what it cannot spell, per value", () => {
    expect(spell(-1)).toBeNull();
    expect(spell(1.5)).toBeNull();
    // 1000 × the largest declared scale, exclusive — there is no word above
    // "miliardo" in the table to compose the multiplier from.
    expect(spell(1e12)).toBeNull();
    expect(spell(999e9)).toBe("novecentonovantanove miliardi");
  });

  test("the derived scale plural is a spelling the table declares", () => {
    // `italianSpeller` writes "milioni" and "miliardi" by applying the regular
    // -e/-o → -i plural to the singular it looked up, and `italianNumerals`
    // reads them out of `CARDINALS.scales`. This is the seam between those two
    // claims: a plural the speller can write and the table has not declared
    // would be a word Italian prints and cannot read back.
    for (const [word, value] of Object.entries(CARDINALS.scales)) {
      if (value < 1_000_000) continue;
      expect(italian.numerals?.([word])?.value).toEqual(new Decimal(value));
    }
    expect(CARDINALS.scales.milioni).toBe(1_000_000);
    expect(CARDINALS.scales.miliardi).toBe(1_000_000_000);
  });
});

describe("italian morphology", () => {
  /**
   * The substitution table, one row per class. `suffixStripper` cannot produce
   * any of these: Italian replaces the final vowel rather than adding to it, so
   * removing the ending leaves a stem no vocabulary lists.
   */
  test.each([
    ["metri", "metro"],
    ["chilogrammi", "chilogrammo"],
    ["millenni", "millennio"],
    ["mesi", "mese"],
    ["tonnellate", "tonnellata"],
    ["once", "oncia"],
    ["franchi", "franco"],
    // The feminine half of that same velar class. It is listed beside its
    // masculine twin deliberately: the two rows describe one orthographic rule
    // (the h that keeps `c`/`g` hard in front of a front vowel), and a table
    // that carried only the masculine half folded "piche" to "picha" — the
    // reading @smartput/measure's pica needs, reachable through no other row.
    ["piche", "pica"],
    ["righe", "riga"],
    ["miglia", "miglio"],
    ["calorie", "caloria"],
    // Capitalised at the start of a sentence, and the fold is on the ending,
    // so the lemma comes back capitalised too — the resolver folds case on the
    // way into the alias index.
    ["Chilogrammi", "Chilogrammo"],
  ])("%s folds to %s", (surface, lemma) => {
    expect(forms(surface)).toContain(lemma);
  });

  test("the surface as typed is always offered", () => {
    // `identity()` first, at weight 0, so an exactly listed alias outranks
    // every folded form.
    expect(forms("chilogrammo")[0]).toBe("chilogrammo");
    expect(analyze("chilogrammo")[0]?.weight).toBe(0);
    expect(analyze("chilogrammi").find((a) => a.form === "chilogrammo")?.weight).toBe(-2);
  });

  test("the invariant class is left alone", () => {
    // A stressed final vowel and a loanword: both are invariant in Italian, and
    // both are offered unchanged with nothing invented beside them.
    expect(forms("unità")).toEqual(["unità"]);
    expect(forms("watt")).toEqual(["watt"]);
    expect(forms("bar")).toEqual(["bar"]);
  });

  test("a two-letter symbol survives the fold", () => {
    // The reason `minStem` is 2. "mi" and "ha" end in a vowel a rule fires on,
    // and shredding them would hand the resolver a one-letter stem.
    expect(forms("mi")).toEqual(["mi"]);
    expect(forms("ha")).toEqual(["ha"]);
    expect(forms("kg")).toEqual(["kg"]);
    // …and the shortest word the fold is still allowed to reach, whose stem is
    // exactly two letters.
    expect(forms("once")).toContain("oncia");
  });
});

describe("italian keywords", () => {
  test("claims the conversion prepositions", () => {
    expect(italian.keywords.in).toEqual(["in", "a"]);
    expect(italian.keywords.of).toEqual(["di"]);
  });

  test("spells the arithmetic operators, accent optional", () => {
    // "più" as a careful keyboard writes it and "piu" as everyone else does —
    // the same word, and no way to know which one a user's keyboard produced.
    expect(italian.keywords.plus).toEqual(["più", "piu"]);
    expect(italian.keywords.minus).toEqual(["meno"]);
    expect(italian.keywords.times).toEqual(["per"]);
    expect(italian.keywords.over).toEqual(["diviso"]);
  });

  test("no surface is claimed for two keywords", () => {
    // The rule `buildKeywords` enforces across languages, asserted here within
    // one: "per" is `times` and nothing else, which is why `by` is unclaimed
    // and "diviso per" is spelled "diviso".
    const seen = new Map<string, string>();
    for (const [keyword, aliases] of Object.entries(italian.keywords)) {
      for (const alias of aliases ?? []) {
        expect(seen.get(alias) ?? keyword).toBe(keyword);
        seen.set(alias, keyword);
      }
    }
    expect(italian.keywords.by).toBeUndefined();
    expect(italian.keywords.off).toBeUndefined();
  });
});

/**
 * The axis `selectForm` cannot carry, and the reason `italian` is one of the
 * few languages here that declares a `renderQuantity` at all.
 *
 * Italian's unit nouns span both genders, and the numeral 1 is also the
 * indefinite article, so it agrees with whatever noun follows it. That
 * agreement is invisible to `selectForm` — which is told a count and a slot,
 * neither of which is a gender — and invisible to `spell`, which is handed a
 * magnitude and no noun at all. `renderQuantity` is the one call that sees the
 * number and the word together, which is where the rewrite has to live.
 *
 * Driven through `Language.renderQuantity` directly rather than through a
 * `Printer`: the rewrite is a property of the language, and a test that built
 * the whole stage stack to reach it would be pinning the printer's plumbing
 * beside it. `print.test.ts` and the per-kind `it.test.ts` files exercise the
 * assembled path.
 */
describe("italian number–noun agreement", () => {
  const render = (number: string, form: string) =>
    italian.renderQuantity?.({
      number,
      form,
      kind: "mass",
      unit: "kg",
      slot: "after-number",
      gap: " ",
    });

  test.each([
    // The ordinary masculine: apocopated, and never the citation "uno".
    ["chilogrammo", "un chilogrammo"],
    ["metro", "un metro"],
    // A masculine before a vowel apocopates too — it is "un ettaro", not "uno
    // ettaro" and not the feminine "un'ettaro".
    ["ettaro", "un ettaro"],
    // The -e class, masculine in every unit noun this repo prints.
    ["pollice", "un pollice"],
    ["gallone", "un gallone"],
    // The consonant-final invariant class, and a mute h behaves as a vowel does.
    ["watt", "un watt"],
    ["hertz", "un hertz"],
    ["gon", "un gon"],
    // The ordinary feminine.
    ["tonnellata", "una tonnellata"],
    ["libbra", "una libbra"],
    ["settimana", "una settimana"],
    // Feminine before a vowel: obligatory elision, and written tight against
    // the noun regardless of the caller's `gap`.
    ["ora", "un'ora"],
    ["oncia", "un'oncia"],
    // …but not before a semiconsonantal i, which is a glide and not the vowel
    // it is spelled with: "la iena", "una iarda".
    ["iarda", "una iarda"],
    // The *s impura* and its company keep the full "uno" — the same environment
    // that takes "lo" rather than "il". Both live in `@smartput/rate/locale/it`.
    ["zloty", "uno zloty"],
    ["yen", "uno yen"],
    // The trap in deriving gender from the ending: a compound in -ora is
    // masculine, because its head is the invariant masculine loanword and not
    // the feminine "ora" welded to it. "una chilowattora" is what a bare
    // "ends in -a is feminine" rule prints, and it is wrong.
    ["chilowattora", "un chilowattora"],
    ["wattora", "un wattora"],
    ["megawattora", "un megawattora"],
  ])("uno + %s is %s", (noun, expected) => {
    expect(render("uno", noun)).toBe(expected);
  });

  test("only the standalone `uno` is rewritten", () => {
    // A compound ending in the same syllable stands as it is: "ventuno metri"
    // is what Italian writes, the truncated "ventun metri" being an option
    // rather than the rule — and the noun after it is plural anyway, so there
    // is no gender being agreed with.
    expect(render("ventuno", "metri")).toBe("ventuno metri");
    expect(render("centouno", "metri")).toBe("centouno metri");
    // "un milione" is already apocopated by `italianSpeller`, which can see
    // that noun because it is one of its own scale words.
    expect(render("un milione", "chilogrammi")).toBe("un milione chilogrammi");
    expect(render("due", "tonnellate")).toBe("due tonnellate");
  });

  test("the digits path is untouched, byte for byte", () => {
    // `formatValue` hands this function "1", never "uno", so the ordinary
    // output every other test in the repo asserts cannot be reached by the
    // rewrite. Nor can a unit that prints a symbol rather than a word.
    expect(render("1", "chilogrammo")).toBe("1 chilogrammo");
    expect(render("1", "ora")).toBe("1 ora");
    expect(
      italian.renderQuantity?.({
        number: "uno",
        symbol: "kg",
        kind: "mass",
        unit: "kg",
        slot: "after-number",
      }),
    ).toBe("uno kg");
  });
});
