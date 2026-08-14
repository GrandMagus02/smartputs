import { describe, expect, test } from "bun:test";
import { Decimal } from "../decimal";
import { lex } from "../parse/lex";
import { normalize } from "../parse/normalize";
import { foldNumerals } from "../parse/numerals";
import type { Slot } from "../types";
import { composeLocale } from "./compose";
import { french } from "./fr";
import { numberSymbols, parseNumber } from "./number";

const form = (n: number, slot: Slot = "bare") =>
  french.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot });

/** No vocabularies: every assertion below is about the language's mechanics. */
const fr = composeLocale(french);

/**
 * The token stream's own rule, applied by hand.
 *
 * `normalize()` maps every dash to "-", `lex` emits it as an op, and
 * `foldNumerals`' `collectRun` absorbs a hyphen that joins two words with
 * nothing between them — so a French numeral written the way French writes it
 * reaches `Language.numerals` already split. Splitting on the hyphen here is
 * what makes the spell/parse round trip below a claim about the real pipeline
 * rather than about a string.
 */
const asRun = (spelled: string) => spelled.split(/[\s-]+/);

/** The same trip through the real passes, for the test that checks `asRun`. */
const foldedValue = (input: string) => {
  const tokens = foldNumerals(lex(normalize(input).text, fr), fr);
  return tokens[0]?.type === "number" ? tokens[0].value.toString() : null;
};

describe("french number symbols", () => {
  /**
   * Escapes, not literals. U+202F is invisible in source *and* narrower than
   * the space beside it, so it degrades to a plain space the moment anyone
   * retypes the line — the same hazard `uk.test.ts` pins for U+00A0, one
   * codepoint over. Reading the separator back from CLDR rather than hardcoding
   * the non-breaking space is the whole difference between passing here and
   * passing only in Ukrainian.
   */
  test("takes its number symbols from CLDR", () => {
    expect(numberSymbols(french)).toEqual({ group: "\u202F", decimal: "," });
  });

  /**
   * The round trip the separator exists to survive. `normalize()` folds every
   * `\s` — U+202F included — to a plain space several stages before anything
   * tries to read a number, so what `parseNumber` is handed is never the
   * character CLDR emitted.
   */
  test("its own grouped output survives normalization and reads back", () => {
    const printed = new Intl.NumberFormat("fr").format(1234567.5);
    expect(printed).toBe("1\u202F234\u202F567,5");

    const folded = normalize(printed).text;
    expect(folded).toBe("1 234 567,5");
    expect(folded).not.toContain("\u202F");

    expect(parseNumber(folded, french)?.toString()).toBe("1234567.5");
    // And the character CLDR actually emitted, for a caller that skipped the
    // normalizer: `parseNumber` drops U+202F unconditionally, not only when it
    // happens to equal this language's separator.
    expect(parseNumber(printed, french)?.toString()).toBe("1234567.5");
  });

  /**
   * The lexer's half of the same round trip. Its three-digit lookahead is what
   * keeps the folded separator from being read as a word boundary, and the
   * second row is the control: a space *not* followed by exactly three digits
   * still separates two numbers.
   */
  test("a folded group separator stays inside the number", () => {
    const grouped = lex("2 000 g", fr);
    expect(grouped.map((t) => t.type)).toEqual(["number", "word"]);
    expect(grouped[0]).toMatchObject({ type: "number", text: "2 000" });

    expect(lex("2 30 g", fr).map((t) => t.type)).toEqual(["number", "number", "word"]);
  });
});

describe("french plural selection", () => {
  /**
   * The whole key set, and where each key comes from. Two keys — see
   * `selectForm`'s own comment for why CLDR's third French category does not
   * become a third row in every vocabulary in the repo.
   *
   * The boundary is not English's, which is the row a vocabulary ported by
   * renaming English columns gets wrong: French is singular on everything below
   * two, so 0 is "zéro kilogramme" and 1,5 is "un kilogramme et demi" — "1,5
   * kilogramme", not "kilogrammes".
   */
  test.each([
    [0, "one"],
    [1, "one"],
    // Fractions under two, which English calls `other` and French does not.
    [0.5, "one"],
    [1.5, "one"],
    [1.9, "one"],
    // The boundary itself.
    [2, "other"],
    [2.5, "other"],
    [5, "other"],
    [21, "other"],
    [100, "other"],
    [1000, "other"],
  ])("%p selects %s", (count, key) => {
    expect(form(count)).toBe(key);
  });

  /**
   * The decision this language makes about CLDR, asserted from both sides so it
   * reads as a choice rather than an oversight: the platform offers `many` on
   * an exact million and `selectForm` folds it into `other`, because a unit
   * noun does not agree with it — French writes "2 000 000 kilogrammes" with
   * the same plural as "2 kilogrammes".
   */
  test("CLDR's `many` folds into `other`", () => {
    expect(new Intl.PluralRules("fr").resolvedOptions().pluralCategories).toContain(
      "many",
    );
    expect(new Intl.PluralRules("fr").select(1_000_000)).toBe("many");
    expect(form(1_000_000)).toBe("other");
    // Not an exact million, and therefore `other` at CLDR too — the pair proves
    // the fold is what changed the first row and not the magnitude.
    expect(form(1_500_000)).toBe("other");
  });

  /**
   * No count at all — ruling R5's row, and the right answer for French on its
   * own terms: a conversion target carries no magnitude ("1 kg en grammes") and
   * French names the target in the plural.
   */
  test("a count-free conversion target still names a key", () => {
    expect(
      french.selectForm({ kind: "mass", unit: "kg", slot: "conversion-target" }),
    ).toBe("other");
  });

  /**
   * The slot is inert, unlike Ukrainian's and unlike the German proof's. French
   * unit nouns do not inflect for case — "en grammes" is the same word as
   * "5 grammes" — so a French `forms` table has exactly the two rows above and
   * no second axis. Pinned rather than left implicit, because "the slot does
   * nothing" is precisely the kind of fact a later edit breaks silently.
   */
  test.each(["bare", "after-number", "conversion-target"] as const)(
    "the %s slot changes no key",
    (slot) => {
      expect(form(1, slot)).toBe("one");
      expect(form(2, slot)).toBe("other");
    },
  );

  /** The contract three later vocabularies key their `forms` tables off. */
  test("the key set is exactly one | other", () => {
    const keys = new Set<string>();
    const slots: Slot[] = ["bare", "after-number", "conversion-target", "invented"];
    for (const slot of slots) {
      keys.add(french.selectForm({ kind: "mass", unit: "kg", slot }));
      for (const n of [0, 0.5, 1, 1.5, 2, 3, 11, 21, 100, 1_000_000, 1_500_000]) {
        keys.add(form(n, slot));
      }
    }
    expect([...keys].sort()).toEqual(["one", "other"]);
  });
});

describe("french cardinals", () => {
  /**
   * Reading, on runs shaped the way `collectRun` hands them over. Each row is
   * an irregularity French has and the two shipped languages do not.
   */
  test.each([
    // Straight addition, the shared fold's own case.
    [["vingt", "deux"], 22, 2],
    // The connector at 21, skipped and never claimed on its own.
    [["vingt", "et", "un"], 21, 3],
    // The teens are a sum, which is why 17–19 are not in the table.
    [["dix", "sept"], 17, 2],
    // Seventy is sixty plus a teen. No rule of its own; it falls out.
    [["soixante", "dix"], 70, 2],
    [["soixante", "et", "onze"], 71, 3],
    [["soixante", "dix", "sept"], 77, 3],
    // The vigesimal eighty — the one pair of words this parser special-cases —
    // in both the spelling that ends a number and the one that does not.
    [["quatre", "vingts"], 80, 2],
    [["quatre", "vingt", "un"], 81, 3],
    [["quatre", "vingt", "dix"], 90, 3],
    [["quatre", "vingt", "dix", "neuf"], 99, 4],
    // The reading that decided `vingt` is an addend and not a scale: as a scale
    // this would multiply and answer 2000.
    [["cent", "vingt"], 120, 2],
    [["cent", "quatre", "vingts"], 180, 3],
    [["deux", "cents"], 200, 2],
    [["deux", "cent", "un"], 201, 3],
    [["mille"], 1000, 1],
    [["mille", "cinq", "cents"], 1500, 3],
    [["deux", "cent", "mille"], 200_000, 3],
    [["un", "million", "deux", "cent", "mille"], 1_200_000, 5],
    // The long scale: `billion` is 10^12 in French.
    [["deux", "billions"], 2_000_000_000_000, 2],
    // Feminine agreement, an extra key on 1.
    [["une"], 1, 1],
    [["zéro"], 0, 1],
  ])("%p reads as %p", (words, value, consumed) => {
    expect(french.numerals?.(words as string[])).toEqual({
      value: new Decimal(value),
      consumed,
    });
  });

  test("a claim stops at the first word it cannot read", () => {
    expect(french.numerals?.(["quatre", "vingts", "kilogrammes"])).toEqual({
      value: new Decimal(80),
      consumed: 2,
    });
    // A connector on its own is never a claim — the guard that keeps "cinq et
    // kg" from swallowing the "et".
    expect(french.numerals?.(["et", "cinq"])).toBeNull();
    expect(french.numerals?.(["cinq", "et"])).toEqual({
      value: new Decimal(5),
      consumed: 1,
    });
    expect(french.numerals?.(["kilogrammes"])).toBeNull();
  });

  /**
   * Writing, pinned as strings for every case where French's orthography is the
   * point: the hyphens, the "et" that appears at 21 and 71 and not at 81, and
   * the -s that `vingt` and `cent` take only as a bare multiplier ending the
   * number.
   */
  test.each([
    [0, "zéro"],
    [1, "un"],
    [16, "seize"],
    [17, "dix-sept"],
    [21, "vingt et un"],
    [22, "vingt-deux"],
    [31, "trente et un"],
    [70, "soixante-dix"],
    [71, "soixante et onze"],
    [77, "soixante-dix-sept"],
    // The -s, and its absence one row later.
    [80, "quatre-vingts"],
    [81, "quatre-vingt-un"],
    [90, "quatre-vingt-dix"],
    [97, "quatre-vingt-dix-sept"],
    [100, "cent"],
    [101, "cent un"],
    [180, "cent quatre-vingts"],
    [200, "deux cents"],
    [201, "deux cent un"],
    [280, "deux cent quatre-vingts"],
    // `mille` is invariable and uncounted at one.
    [1000, "mille"],
    [1500, "mille cinq cents"],
    [2000, "deux mille"],
    // …and it suppresses the -s on whatever multiplies it, because it is a
    // numeral rather than the noun that would license one.
    [80_000, "quatre-vingt mille"],
    [200_000, "deux cent mille"],
    // A noun scale, which takes its own -s and licenses the one on `cent`.
    [1_000_000, "un million"],
    [2_000_000, "deux millions"],
    [1_200_000, "un million deux cent mille"],
    [200_000_000, "deux cents millions"],
    [1_000_000_000, "un milliard"],
    [1_000_000_000_000, "un billion"],
  ])("%p spells as %p", (value, spelled) => {
    expect(french.spell?.(new Decimal(value))).toBe(spelled);
  });

  test("declines the three values the tables cannot reach", () => {
    expect(french.spell?.(new Decimal("1.5"))).toBeNull();
    expect(french.spell?.(new Decimal(-5))).toBeNull();
    // 1000 × the largest declared scale, exclusive.
    expect(french.spell?.(new Decimal("1e15"))).toBeNull();
    expect(french.spell?.(new Decimal("999999999999999"))).not.toBeNull();
  });

  /**
   * The two directions closed against each other, through the token stream's
   * own hyphen rule. This is what "one table, two directions" buys: an edit to
   * `CARDINALS` that breaks either half fails here.
   */
  test.each([
    0, 1, 2, 16, 17, 19, 20, 21, 22, 30, 31, 60, 70, 71, 72, 77, 79, 80, 81, 90, 91, 97,
    99, 100, 101, 120, 180, 200, 201, 280, 999, 1000, 1500, 2000, 80_000, 200_000,
    1_000_000, 2_000_000, 1_200_000, 200_000_000, 1_000_000_000, 1_000_000_000_000,
  ])("%p spells and reads back as itself", (value) => {
    const spelled = french.spell?.(new Decimal(value));
    expect(spelled).not.toBeNull();
    const run = asRun(spelled as string);
    expect(french.numerals?.(run)).toEqual({
      value: new Decimal(value),
      consumed: run.length,
    });
  });
});

/**
 * The claim `asRun` above stands in for, made once against the real passes:
 * French writes its numerals with hyphens, `normalize` turns every dash into
 * "-", `lex` emits that as a subtraction op, and `collectRun` absorbs it only
 * where nothing separates it from the words on either side. So the parser is
 * offered `["quatre", "vingt", "dix", "sept"]` without this file arranging it,
 * and the spaced-out spelling — which is subtraction and not a numeral — is the
 * control that proves the absorption is the hyphen's tightness and not its
 * presence.
 */
describe("french numerals through the token stream", () => {
  test.each([
    ["quatre-vingt-dix-sept kg", "97"],
    ["vingt-deux kg", "22"],
    ["soixante et onze kg", "71"],
    ["quatre-vingts kg", "80"],
    ["deux cent mille kg", "200000"],
  ])("%s folds to %s", (input, value) => {
    expect(foldedValue(input)).toBe(value);
  });

  test("a hyphen with a space beside it is still subtraction", () => {
    const tokens = foldNumerals(lex(normalize("quatre - vingts").text, fr), fr);
    expect(tokens.map((t) => t.type)).toEqual(["number", "op", "number"]);
  });
});

/**
 * The analyzer chain, which is two entries and one of them is `identity`. The
 * rows below are the ones the doc comment makes a claim about, so that the
 * claim fails here rather than being believed.
 */
describe("french morphology", () => {
  const forms = (surface: string) =>
    (french.analyze ?? []).flatMap((a) =>
      a(surface, { locale: "fr", words: [surface], index: 0 }),
    );
  const stems = (surface: string) =>
    forms(surface)
      .filter((f) => f.form !== surface)
      .map((f) => f.form);

  test.each([
    ["grammes", "gramme"],
    ["kilomètres", "kilomètre"],
    ["nœuds", "nœud"],
    ["degrés", "degré"],
    // -x, the ending no unit noun in the repo actually takes.
    ["bijoux", "bijou"],
  ])("%p strips to %p", (surface, stem) => {
    expect(stems(surface)).toContain(stem);
  });

  /**
   * The claim the doc comment makes about the class it deliberately cannot
   * reach. "chevaux" is the plural of "cheval", and -aux is a rewrite of the
   * last two letters rather than a suffix — so taking the single -x off yields
   * "chevau", which is what a one-character stripper can do and is not the
   * singular. Asserted so that anyone tempted to add "aux" to the suffix list
   * has to come here and say why.
   */
  test("the -al/-aux class is out of reach, and visibly so", () => {
    expect(stems("chevaux")).toEqual(["chevau"]);
    expect(stems("chevaux")).not.toContain("cheval");
  });

  /**
   * `minStem: 3` is what keeps the stripper off the two-letter symbols a unit
   * is usually written with. "Mo", "ko" and "kg" have no -s to take; the row
   * that matters is a three-letter symbol whose stem would be two.
   */
  test.each(["bps", "mps", "abs"])("%p is too short to strip", (surface) => {
    expect(stems(surface)).toEqual([]);
  });

  test("an exact surface is always offered unpenalised beside any stem", () => {
    expect(forms("grammes")).toContainEqual({ form: "grammes", weight: 0 });
    expect(forms("grammes")).toContainEqual({ form: "gramme", weight: -2 });
  });
});

describe("french keywords", () => {
  test("claims the conversion prepositions", () => {
    expect(french.keywords.in).toEqual(["en", "vers"]);
    expect(french.keywords.of).toEqual(["de"]);
    expect(french.keywords.by).toEqual(["par"]);
  });

  /**
   * `off`, and the limit its own comment states. The keyword is a single token
   * taking the percentage on its left and the base on its right, so the only
   * spelling it serves is "20 % remise 50" — while the phrase French actually
   * writes puts a preposition on either side of the noun, and that one lexes
   * as two keywords in a row with a word the grammar has no production for
   * standing between them.
   *
   * Pinned rather than described, because "the idiomatic phrase does not parse"
   * is exactly the kind of fact a reader assumes was solved.
   */
  test("off is claimed as a bare noun, and only that shape lexes", () => {
    expect(french.keywords.off).toEqual(["remise"]);
    expect(lex("20 % remise 50", fr).map((t) => t.type)).toEqual([
      "number",
      "word",
      "keyword",
      "number",
    ]);
    // The idiomatic phrase: "de" is already `of`, and "sur" is claimed by
    // nothing, so the run reaches the parser as keyword-keyword-word.
    expect(lex("20 % de remise sur 50", fr).map((t) => t.type)).toEqual([
      "number",
      "word",
      "keyword",
      "keyword",
      "word",
      "number",
    ]);
  });

  /**
   * The land-grab test `en.ts` states for itself under `off`: a keyword takes a
   * surface away from every unit alias in every installed language, because
   * `lex` consults `buildKeywords` before the alias index is read. None of
   * French's ten surfaces is a word any kind in this repo spells a unit with.
   */
  test("no keyword is a word this grammar needs elsewhere", () => {
    const surfaces = Object.values(french.keywords).flat();
    expect(surfaces).toEqual([
      "en",
      "vers",
      "de",
      "remise",
      "plus",
      "moins",
      "fois",
      "multiplié",
      "divisé",
      "par",
    ]);
    // "et" is the numeral connector and is deliberately *not* among them —
    // `fr-cardinals.ts` needs it to read "vingt et un", and a language cannot
    // have one surface be both a connector and an operator.
    expect(surfaces).not.toContain("et");
    // Nor is "à", which French uses to write a range ("de 5 à 10").
    expect(surfaces).not.toContain("à");
  });

  test("the phrasal operators lex as keywords", () => {
    expect(lex("1 kg en g", fr).map((t) => t.type)).toEqual([
      "number",
      "word",
      "keyword",
      "word",
    ]);
    // "divisé par" is two keywords that `foldWordOps` makes one operator; "fois"
    // is the bare form and needs no `by` behind it.
    expect(lex("6 divisé par 2", fr).map((t) => t.type)).toEqual([
      "number",
      "keyword",
      "keyword",
      "number",
    ]);
    expect(lex("3 fois 5", fr).map((t) => t.type)).toEqual([
      "number",
      "keyword",
      "number",
    ]);
  });

  /**
   * The elision finding, asserted rather than described. `lex` keeps an
   * apostrophe *between two letters* inside the word, so the elided "de"
   * arrives fused to what follows it and no "d'" keyword could ever match —
   * which is why `keywords.of` does not declare one. Both apostrophes people
   * type are covered by the same rule.
   */
  test.each(["d'un", "d’une"])("%s lexes as one word, not a keyword", (text) => {
    const tokens = lex(`20 % ${text}`, fr);
    expect(tokens.map((t) => t.type)).toEqual(["number", "word", "word"]);
    expect(tokens[2]).toMatchObject({ type: "word", text });
    expect(french.keywords.of).not.toContain("d'");
  });
});

describe("french typography", () => {
  /**
   * A space before every label, symbols included — the rule the SI brochure and
   * French style guides state, and the one difference from
   * `defaultRenderQuantity`, which sets a symbol tight against the number.
   */
  test.each([
    [{ symbol: "kg" }, "5 kg"],
    [{ symbol: "%" }, "5 %"],
    [{ form: "kilogrammes" }, "5 kilogrammes"],
    [{ alias: "kilogramme" }, "5 kilogramme"],
    // The half-translated floor, which must still degrade to the unit key.
    [{}, "5 kg"],
  ])("%p renders as %p", (parts, expected) => {
    expect(
      french.renderQuantity?.({
        number: "5",
        kind: "mass",
        unit: "kg",
        slot: "bare",
        ...parts,
      }),
    ).toBe(expected);
  });

  test("a caller's own gap still wins", () => {
    expect(
      french.renderQuantity?.({
        number: "5",
        kind: "mass",
        unit: "kg",
        slot: "bare",
        symbol: "kg",
        gap: "",
      }),
    ).toBe("5kg");
  });
});

test("the language ships no word for any unit", () => {
  expect(french.id).toBe("fr");
  // The whole of what a `Language` may contain, restated as a shape: mechanics,
  // and a keyword table whose every entry is a connective.
  expect(Object.keys(french.keywords).sort()).toEqual([
    "by",
    "in",
    "minus",
    "of",
    "off",
    "over",
    "plus",
    "times",
  ]);
  expect(french.segment).toBeUndefined();
});
