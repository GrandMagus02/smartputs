import { expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { createEngine } from "../engine";
import { UnitParseError } from "../errors";
import { buildKeywords, composeLocale } from "../locale/compose";
import { defineLanguage } from "../locale/define";
import { lex } from "./lex";

const en = composeLocale(
  defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: { in: ["in", "to", "as"] },
    selectForm: () => "other",
  }),
);

test("lexes a number and a word with correct spans", () => {
  const tokens = lex("10 kg", en);
  expect(tokens).toHaveLength(2);
  expect(tokens[0]).toMatchObject({ type: "number", start: 0, end: 2 });
  expect(tokens[1]).toMatchObject({ type: "word", text: "kg", start: 3, end: 5 });
});

test("lexes a number with no space before its unit", () => {
  const tokens = lex("10kg", en);
  expect(tokens.map((t) => t.type)).toEqual(["number", "word"]);
});

test("lexes operators and parens", () => {
  expect(lex("(1 + 2) * 3 / 4 - 5", en).map((t) => t.type)).toEqual([
    "lparen",
    "number",
    "op",
    "number",
    "rparen",
    "op",
    "number",
    "op",
    "number",
    "op",
    "number",
  ]);
});

test("recognizes locale keywords", () => {
  const tokens = lex("10 kg in g", en);
  expect(tokens[2]).toMatchObject({ type: "keyword", keyword: "in" });
});

test("keyword matching is case-insensitive, like unit matching", () => {
  for (const input of ["10 kg IN g", "10 kg In g", "10 kg iN g"]) {
    expect(lex(input, en)[2]).toMatchObject({ type: "keyword", keyword: "in" });
  }
});

test("a keyword alias written in caps still matches a lowercase surface", () => {
  const shouty = composeLocale(
    defineLanguage({
      id: "en",
      numberFormat: "intl",
      keywords: { in: ["IN"] },
      selectForm: () => "other",
    }),
  );
  expect(lex("10 kg in g", shouty)[2]).toMatchObject({ type: "keyword", keyword: "in" });
});

test("keeps grouped numbers as one token", () => {
  const tokens = lex("1,500.25 kg", en);
  expect(tokens[0]).toMatchObject({ type: "number" });
  expect(tokens).toHaveLength(2);
});

/**
 * `normalize()` folds every whitespace run to a plain space before `lex` runs,
 * so a language that groups with U+00A0 — Ukrainian does, French ICU groups with
 * U+202F — never sees its own separator here. Without accepting the folded form,
 * such a language cannot read back the number it just printed: two kind packages
 * carried a pinned `expect(...).toThrow()` naming exactly this.
 */
const uk = composeLocale(
  defineLanguage({
    id: "uk",
    numberFormat: { group: "\u00A0", decimal: "," },
    keywords: { in: ["в"] },
    selectForm: () => "other",
  }),
);

test("a group separator folded to a plain space still lexes as one number", () => {
  // An escape for the separator itself, because the character is invisible in
  // source: what the formatter emitted was "2\u00A0000", and what reaches `lex`
  // after `normalize()` is "2 000" with a plain space.
  const tokens = lex("2 000 грамів", uk);
  expect(tokens[0]).toMatchObject({ type: "number", text: "2 000", start: 0, end: 5 });
  expect(tokens.map((t) => t.type)).toEqual(["number", "word"]);
  // Every group in a longer number, and a decimal on the end of it.
  const long = lex("1 234 567,5", uk);
  expect(long).toHaveLength(1);
  expect(long[0]).toMatchObject({ type: "number", text: "1 234 567,5" });
});

test("only a run of exactly three digits counts as a folded group", () => {
  // A group separator is followed by three digits and no more, which is what
  // keeps the rule from swallowing a word boundary: two adjacent numbers stay
  // two tokens.
  expect(lex("2 3 кг", uk).map((t) => t.type)).toEqual(["number", "number", "word"]);
  expect(lex("2 0000 кг", uk).map((t) => t.type)).toEqual(["number", "number", "word"]);
  expect(lex("2 кг", uk).map((t) => t.type)).toEqual(["number", "word"]);
  // And `en`, whose separator is not space-like at all, is untouched: a space
  // inside a number is a word boundary there and stays one.
  expect(lex("1 500 kg", en).map((t) => t.type)).toEqual(["number", "number", "word"]);
});

test("backs off a trailing separator that is not part of the number", () => {
  const tokens = lex("1,500. kg", en);
  expect(tokens[0]).toMatchObject({ type: "number", text: "1,500", start: 0, end: 5 });
  expect(tokens.map((t) => t.type)).toEqual(["number", "word"]);
});

test("skips unrecognized characters instead of throwing", () => {
  // suggest() must never crash on junk.
  expect(() => lex("10 kg @@ 5", en)).not.toThrow();
  expect(lex("10 kg @@ 5", en).map((t) => t.type)).toEqual(["number", "word", "number"]);
});

test("a unit symbol in the allowlist lexes as a word", () => {
  const tokens = lex("20%", en);
  expect(tokens.map((t) => t.type)).toEqual(["number", "word"]);
  expect(tokens[1]).toMatchObject({ type: "word", text: "%", start: 2, end: 3 });
});

test("a degree sign is still skipped, so 20 °C resolves via the C word alone", () => {
  // This is the case that rules out a general "any symbol becomes a word"
  // fix: "°" is not in UNIT_SYMBOLS, so it falls through the
  // unrecognized-character path exactly like today, and "°C" lexes as the
  // single word "C".
  const tokens = lex("20 °C", en);
  expect(tokens.map((t) => t.type)).toEqual(["number", "word"]);
  expect(tokens[1]).toMatchObject({ type: "word", text: "C" });
});

/**
 * Every spelling of multiplication `OPS` accepts, written as escapes for the
 * same reason the table is: U+00B7 and U+22C5 are indistinguishable from "."
 * at most sizes, and a test whose point is "this is not a decimal point" must
 * not be readable as one.
 */
const DOTS = ["\u00B7", "\u00D7", "\u22C5"] as const;

test("an SI multiplication dot lexes as the multiplication operator", () => {
  for (const dot of DOTS) {
    const tokens = lex(`2 ${dot} 3`, en);
    expect(
      tokens.map((t) => t.type),
      dot,
    ).toEqual(["number", "op", "number"]);
    // Canonicalized to "*", not carried through as a second name for one
    // operation: `pratt.ts` prices `BINDING["*"]` and nothing else.
    expect(tokens[1], dot).toMatchObject({ type: "op", op: "*", start: 2, end: 3 });
  }
});

test("a multiplication dot between digits is an operator, not a decimal point", () => {
  // Three tokens, so the value is 1 * 5 and never 1.5. The number scanner only
  // absorbs the locale's own group and decimal symbols, and neither language
  // here declares one of these — English's decimal is "." (U+002E), a different
  // character from U+00B7 however alike they look, and Ukrainian's is ",".
  for (const dot of DOTS) {
    for (const locale of [en, uk]) {
      const tokens = lex(`1${dot}5`, locale);
      const label = `${locale.id} ${dot}`;
      expect(
        tokens.map((t) => t.type),
        label,
      ).toEqual(["number", "op", "number"]);
      expect(tokens[0], label).toMatchObject({ type: "number", text: "1" });
      expect(tokens[2], label).toMatchObject({ type: "number", text: "5" });
    }
  }
});

test("a dot ends a unit word, so a printed product symbol lexes as a product", () => {
  // The case the table was added for: "кВт·год" is `energy:kwh`'s Ukrainian
  // symbol, and what the resolver needs to see is two unit words with a `*`
  // between them — kilowatt times hour — rather than one word it has never
  // heard of. Evaluating it is `@smartput/kinds`' ukrainian.test.ts; this is
  // only the token shape underneath.
  const tokens = lex("5 \u043A\u0412\u0442\u00B7\u0433\u043E\u0434", uk);
  expect(tokens.map((t) => t.type)).toEqual(["number", "word", "op", "word"]);
  expect(tokens[1]).toMatchObject({ text: "\u043A\u0412\u0442" });
  expect(tokens[3]).toMatchObject({ text: "\u0433\u043E\u0434" });
});

test("word runs are split by the locale segmenter when provided", () => {
  const zh = composeLocale(
    defineLanguage({
      id: "zh",
      numberFormat: "intl",
      segment: (run) => (run === "公斤克" ? ["公斤", "克"] : [run]),
      keywords: {},
      selectForm: () => "other",
    }),
  );
  expect(lex("10公斤克", zh).map((t) => (t.type === "word" ? t.text : t.type))).toEqual([
    "number",
    "公斤",
    "克",
  ]);
});

// --- The digit-inside-run split, and ruling R-B1 -------------------------

// The oracle `lex` takes as its fourth argument. An engine passes
// `MatchCtx.isUnitAlias`, which asks the registry; a test names the surfaces it
// wants to talk about, so these cases stay readable without a registry.
const keywords = buildKeywords([en]);
const UNIT_ALIASES = new Set(["ft", "in", "cm", "m", "km", "h", "min", "s"]);
const isUnitAlias = (text: string) => UNIT_ALIASES.has(text.toLowerCase());

const shapes = (s: string) =>
  lex(s, en, keywords, isUnitAlias).map((t) => `${t.type}:${"text" in t ? t.text : ""}`);

test("a digit run followed by a letter splits the word run", () => {
  expect(shapes("1h30m")).toEqual(["number:1", "word:h", "number:30", "word:m"]);
  expect(shapes("5ft3in")).toEqual(["number:5", "word:ft", "number:3", "word:in"]);
});

test("trailing digits stay inside the word: m2, km2 and ft3 are units", () => {
  expect(shapes("30 m2")).toEqual(["number:30", "word:m2"]);
  expect(shapes("30 km2")).toEqual(["number:30", "word:km2"]);
  expect(shapes("4 ft3")).toEqual(["number:4", "word:ft3"]);
});

test("a run some vocabulary spells as a unit stays whole even when a letter follows", () => {
  // The case the split asks the alias oracle about at all, and the reason a
  // purely positional rule was not enough: an unspaced language writes its
  // particle straight against the unit, so "5000cm2をm2" would otherwise cut the
  // registered alias "cm2" into "cm" and a 2 — taking every CJK area and volume
  // row in the corpus with it. Registered beats positional.
  const ja = composeLocale(
    defineLanguage({
      id: "ja",
      numberFormat: "intl",
      segment: (run) => (run === "をm" ? ["を", "m"] : [run]),
      keywords: {},
      selectForm: () => "other",
    }),
  );
  const knows = (text: string) => ["cm2", "m2"].includes(text);
  expect(
    lex("5000cm2\u3092m2", ja, buildKeywords([ja]), knows).map(
      (t) => `${t.type}:${"text" in t ? t.text : ""}`,
    ),
  ).toEqual(["number:5000", "word:cm2", "word:\u3092", "word:m2"]);
});

test("spans index the source across a split", () => {
  const [, h, thirty, m] = lex("1h30m", en, keywords, isUnitAlias);
  expect([h?.start, h?.end]).toEqual([1, 2]);
  expect([thirty?.start, thirty?.end]).toEqual([2, 4]);
  expect([m?.start, m?.end]).toEqual([4, 5]);
});

test("R-B1: `in` re-lexes as a word only where it cannot be the conversion keyword", () => {
  const at = (s: string, start: number) =>
    lex(s, en, keywords, isUnitAlias).find((t) => t.start === start)?.type;
  expect(lex("5 ft 3 in", en, keywords, isUnitAlias).at(-1)?.type).toBe("word");
  expect(at("5 ft 3 in + 1 ft", 7)).toBe("word"); // an operator follows
  expect(at("5 ft 3 in cm", 7)).toBe("keyword"); // a unit follows: still converts
  expect(
    lex("5 ft 3 in in cm", en, keywords, isUnitAlias).filter((t) => t.type === "keyword"),
  ).toHaveLength(1);
  expect(at("10 km in m", 6)).toBe("keyword"); // no regression on the ordinary case
});

test("with no alias oracle nothing re-lexes: the default keeps every existing caller", () => {
  expect(lex("5 ft 3 in", en, keywords).at(-1)?.type).toBe("keyword");
});

test('a split run fails at the parser, not at the resolver: `Unknown unit "h30"` is gone', () => {
  const engine = createEngine({
    locales: [composeLocale(english, BUILTIN_EN)],
    kinds: BUILTIN_KINDS,
  });
  expect(() => engine.evaluate("1h30m")).toThrow(UnitParseError);
});
