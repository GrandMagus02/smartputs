import { expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { composeLocale } from "../locale/compose";
import { lex } from "./lex";
import { normalize } from "./normalize";
import { foldNumerals } from "./numerals";

const en = composeLocale(english);

const fold = (input: string) => foldNumerals(lex(normalize(input).text, en), en);

/** Compact shape for assertions: type, surface-ish text, span. */
const shape = (input: string) =>
  fold(input).map((t) => [
    t.type,
    t.type === "number" ? t.value.toString() : t.type === "word" ? t.text : "",
    t.start,
    t.end,
  ]);

test("a single numeral word becomes a number token", () => {
  expect(shape("one kg")).toEqual([
    ["number", "1", 0, 3],
    ["word", "kg", 4, 6],
  ]);
});

test("a multi-word numeral collapses into one token spanning it", () => {
  expect(shape("one thousand thirty two")).toEqual([["number", "1032", 0, 23]]);
});

test("a connector inside a numeral is absorbed", () => {
  expect(shape("two hundred and five g")).toEqual([
    ["number", "205", 0, 20],
    ["word", "g", 21, 22],
  ]);
});

test("a hyphen joining two numeral words is absorbed", () => {
  expect(shape("twenty-two km")).toEqual([
    ["number", "22", 0, 10],
    ["word", "km", 11, 13],
  ]);
});

test("a spaced dash between numeral words stays subtraction", () => {
  expect(shape("twenty - two")).toEqual([
    ["number", "20", 0, 6],
    ["op", "", 7, 8],
    ["number", "2", 9, 12],
  ]);
});

test("a scale word directly after digits multiplies them", () => {
  expect(shape("1.5 million km")).toEqual([
    ["number", "1500000", 0, 11],
    ["word", "km", 12, 14],
  ]);
});

test("a non-scale numeral after digits is left alone", () => {
  expect(shape("5 one")).toEqual([
    ["number", "5", 0, 1],
    ["number", "1", 2, 5],
  ]);
});

test("unit words are untouched", () => {
  expect(shape("10 km")).toEqual([
    ["number", "10", 0, 2],
    ["word", "km", 3, 5],
  ]);
});

test("a numeral run stops at a unit word and resumes after it", () => {
  expect(shape("ten km five km")).toEqual([
    ["number", "10", 0, 3],
    ["word", "km", 4, 6],
    ["number", "5", 7, 11],
    ["word", "km", 12, 14],
  ]);
});

test("a locale without numerals is passed through unchanged", () => {
  const { numerals: _drop, ...language } = english;
  const bare = composeLocale(language);
  const tokens = lex(normalize("one kg").text, bare);
  expect(foldNumerals(tokens, bare)).toBe(tokens);
});

test("a fully spelled six-digit number folds to a single token", () => {
  expect(shape("nine hundred ninety nine thousand nine hundred ninety nine")).toEqual([
    ["number", "999999", 0, 58],
  ]);
});
