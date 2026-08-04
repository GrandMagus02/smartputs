import { expect, test } from "bun:test";
import { identity, suffixStripper, tableAnalyzer } from "./helpers";

const ctx = { locale: "uk" };

test("identity returns the surface form at weight 0", () => {
  expect(identity()("кілограмів", ctx)).toEqual([{ form: "кілограмів", weight: 0 }]);
});

test("suffixStripper offers each strippable suffix at a penalty", () => {
  const a = suffixStripper({ suffixes: ["ів", "и"], minStem: 3, weight: -2 });
  expect(a("кілограмів", ctx)).toEqual([{ form: "кілограм", weight: -2 }]);
});

test("suffixStripper respects minStem", () => {
  const a = suffixStripper({ suffixes: ["ів"], minStem: 10, weight: -2 });
  expect(a("кілограмів", ctx)).toEqual([]);
});

test("suffixStripper never returns an empty stem", () => {
  const a = suffixStripper({ suffixes: ["ів"], minStem: 1, weight: -2 });
  expect(a("ів", ctx)).toEqual([]);
});

test("tableAnalyzer maps known irregulars", () => {
  const a = tableAnalyzer({ кіло: "кілограм" }, -1);
  expect(a("кіло", ctx)).toEqual([{ form: "кілограм", weight: -1 }]);
  expect(a("метр", ctx)).toEqual([]);
});
