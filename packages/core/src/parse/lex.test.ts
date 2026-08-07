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
