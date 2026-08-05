import { expect, test } from "bun:test";
import en from "../locale/en";
import { lex } from "./lex";
import { normalize } from "./normalize";
import { foldWordOps } from "./wordops";

const shape = (input: string) =>
  foldWordOps(lex(normalize(input), en)).map((t) => [
    t.type,
    t.type === "op" ? t.op : t.type === "keyword" ? t.keyword : "",
    t.start,
    t.end,
  ]);

test("plus becomes an addition op spanning the word", () => {
  expect(shape("10 plus 5")).toEqual([
    ["number", "", 0, 2],
    ["op", "+", 3, 7],
    ["number", "", 8, 9],
  ]);
});

test("minus, times and over become their operators", () => {
  expect(shape("10 minus 5")[1]).toEqual(["op", "-", 3, 8]);
  expect(shape("10 times 5")[1]).toEqual(["op", "*", 3, 8]);
  expect(shape("10 over 5")[1]).toEqual(["op", "/", 3, 7]);
});

test("divided by is one operator spanning both words", () => {
  expect(shape("20 divided by 4")).toEqual([
    ["number", "", 0, 2],
    ["op", "/", 3, 13],
    ["number", "", 14, 15],
  ]);
});

test("multiplied by is one operator spanning both words", () => {
  expect(shape("20 multiplied by 4")[1]).toEqual(["op", "*", 3, 16]);
});

test("an operator keyword at end of input still becomes an op token", () => {
  expect(shape("10 divided")[1]).toEqual(["op", "/", 3, 10]);
});

test("a stray by is left for the parser to reject", () => {
  expect(shape("20 by 4")[1]).toEqual(["keyword", "by", 3, 5]);
});

test("conversion and percentage keywords are untouched", () => {
  expect(shape("2 km in m")[2]).toEqual(["keyword", "in", 5, 7]);
  expect(shape("20 % of 50")[2]).toEqual(["keyword", "of", 5, 7]);
});

test("symbolic operators pass through", () => {
  expect(shape("10 + 5")[1]).toEqual(["op", "+", 3, 4]);
});
