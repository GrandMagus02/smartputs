import { expect, test } from "bun:test";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { defineLocale } from "../locale/define";
import { identity, suffixStripper } from "../locale/helpers";
import { createResolver } from "./candidates";

const number = defineKind({
  id: "number",
  value: { mode: "ratio", canonical: "one", units: { one: 1 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
  lexicon: { m: ["m", "metre", "metres"], km: ["km"] },
});
const duration = defineKind({
  id: "duration",
  value: { mode: "ratio", canonical: "s", units: { min: 60 } },
  lexicon: { min: ["min", "m", "minute"] },
});

const en = defineLocale({ id: "en", numberFormat: "intl", keywords: {} });
const registry = buildRegistry([number, length, duration]);
const resolver = (layers: Parameters<typeof createResolver>[0]["layers"] = []) =>
  createResolver({ registry, locale: en, packs: [], layers });

test("an unambiguous alias yields one candidate", () => {
  expect(resolver().resolve("km")).toEqual([
    { kind: "length", unit: "km", weight: 0, surface: "km", form: "km" },
  ]);
});

test("an ambiguous alias yields all candidates, deterministically ordered", () => {
  expect(
    resolver()
      .resolve("m")
      .map((c) => `${c.kind}:${c.unit}`),
  ).toEqual(["duration:min", "length:m"]);
});

test("weights reorder candidates", () => {
  const r = resolver([{ "length:m": 10 }]);
  expect(r.resolve("m").map((c) => `${c.kind}:${c.unit}`)).toEqual([
    "length:m",
    "duration:min",
  ]);
  expect(r.resolve("m")[0]?.weight).toBe(10);
});

test("an unknown surface yields no candidates", () => {
  expect(resolver().resolve("zzz")).toEqual([]);
});

test("nearest suggests close aliases for an unknown surface", () => {
  expect(resolver().nearest("kmm")).toContain("km");
});

test("analyzed forms reach the lexicon and are penalised", () => {
  const uk = defineLocale({
    id: "uk",
    numberFormat: "intl",
    analyze: [identity(), suffixStripper({ suffixes: ["s"], minStem: 3, weight: -2 })],
    keywords: {},
  });
  const r = createResolver({ registry, locale: uk, packs: [], layers: [] });
  const found = r.resolve("metres");
  expect(found.map((c) => `${c.kind}:${c.unit}`)).toEqual(["length:m"]);
  expect(found[0]?.weight).toBe(0);
});

test("a stem match scores below an exact match", () => {
  const uk = defineLocale({
    id: "uk",
    numberFormat: "intl",
    analyze: [identity(), suffixStripper({ suffixes: ["e"], minStem: 3, weight: -2 })],
    keywords: {},
  });
  const r = createResolver({ registry, locale: uk, packs: [], layers: [] });
  // "metre" matches exactly (weight 0); its stem "metr" matches nothing.
  expect(r.resolve("metre")[0]?.weight).toBe(0);
});

test("case is folded before lookup", () => {
  expect(
    resolver()
      .resolve("KM")
      .map((c) => c.unit),
  ).toEqual(["km"]);
});
