import { expect, test } from "bun:test";
import { composeLocale } from "../locale/compose";
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
