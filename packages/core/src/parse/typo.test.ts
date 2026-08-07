import { expect, test } from "bun:test";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english as en } from "@smartput/locale-en";
import { createEngine } from "../engine";
import { NoCandidateError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import { defineLanguage } from "../locale/define";
import { defineVocabulary } from "../locale/vocabulary";
import { TYPO_PENALTY } from "../solve/weights";
import { createResolver } from "./candidates";

// "pint" and "point" are one letter apart and belong to different kinds, which
// is the whole shape of the problem in four words: a correction that runs when
// it should not silently moves a reading to another dimension.
const volume = defineKind({
  id: "volume",
  value: { mode: "ratio", canonical: "l", units: { l: 1, pt: 0.473 } },
});
const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, pt: 0.000353 } },
});

const locale = composeLocale(
  defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: {},
    selectForm: () => "other",
  }),
  [
    defineVocabulary({
      locale: "en",
      kind: "volume",
      units: { pt: { aliases: ["pint"] } },
    }),
    defineVocabulary({
      locale: "en",
      kind: "length",
      units: { pt: { aliases: ["point"] } },
    }),
  ],
);
const registry = buildRegistry([volume, length], [locale]);
const resolver = () => createResolver({ registry, locale, layers: [] });

const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

test("a near miss becomes a candidate when nothing matched exactly", () => {
  const [candidate, ...rest] = resolver().resolve("piont");
  expect(rest).toEqual([]);
  expect(candidate?.kind).toBe("length");
  expect(candidate?.unit).toBe("pt");
  // The corrected word is the form the reading was reached through, exactly as
  // a stemmed form is.
  expect(candidate?.form).toBe("point");
  expect(candidate?.weight).toBeCloseTo(-TYPO_PENALTY * 1.01, 6);
});

test("an exact match suppresses the fuzzy pass for that token", () => {
  // "point" resolves, so "pint" — one edit away, and another kind — is never
  // looked at. Without the guard this returns two candidates and the engine
  // asks the caller which dimension they meant.
  const found = resolver().resolve("point");
  expect(found.map((c) => `${c.kind}:${c.unit}`)).toEqual(["length:pt"]);
  expect(found[0]?.weight).toBe(0);
});

test("a mistyped symbol is not corrected", () => {
  // "kgg" is one edit from "kg" and nothing else, so the distance function
  // would happily correct it. Symbols are too dense for that to be a reading.
  expect(resolver().resolve("ptt")).toEqual([]);
  try {
    engine.evaluate("1 kgg");
    throw new Error("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(NoCandidateError);
    expect((e as NoCandidateError).nearest).toContain("kg");
  }
});

test("a misspelled unit evaluates to the unit it meant", () => {
  const corrected = engine.evaluate("1 klogram");
  expect(corrected.kind).toBe("mass");
  expect(corrected.formatted).toBe(engine.evaluate("1 kilogram").formatted);
});

test("the correction is a term in the breakdown, and scores below the exact reading", () => {
  const corrected = engine.explain("1 klogram").assignments[0];
  const exact = engine.explain("1 kilogram").assignments[0];

  const fuzzy = corrected?.contributions.filter((c) => c.selector === "fuzzy:kilogram");
  expect(fuzzy).toHaveLength(1);
  expect(fuzzy?.[0]?.value).toBeCloseTo(-TYPO_PENALTY, 6);

  // The invariant explain() lives or dies by: every summand of the score has a
  // row, so the rows sum to the score.
  const sum = corrected?.contributions.reduce((a, c) => a + c.value, 0) ?? Number.NaN;
  expect(sum).toBeCloseTo(corrected?.score ?? Number.NaN, 6);

  expect(corrected?.score).toBeLessThan(exact?.score ?? Number.NaN);
  expect(exact?.contributions.some((c) => c.selector.startsWith("fuzzy:"))).toBe(false);

  // Score, not confidence, is where the penalty is legible, and deliberately
  // so. The softmax normalises whatever it is given, so a reading with no
  // rival comes back at 1 whether it was charged or not, and a penalty every
  // assignment of an input shares cancels out of all of them. Both of these
  // read 1; asserting otherwise would be asserting a bug.
  expect(engine.evaluate("1 klogram").confidence).toBe(
    engine.evaluate("1 kilogram").confidence,
  );
});

test("a correction survives a neighbour that agrees on kind", () => {
  // The trade TYPO_PENALTY prices: one slip costs 15, agreeing with the
  // duration on the other side of the "+" is worth 30, so the corrected
  // reading is still believed — and by a margin, not by a hair.
  const [best] = engine.explain("10 m + 5 mintue").assignments;
  expect(best?.kind).toBe("duration");
  expect(best?.score).toBeGreaterThan(0);
});

test("two words equally near still refuse", () => {
  // "litrr" is one substitution from both "litre" and "liter". Picking either
  // is a coin toss that comes back as a number, so the hint is the answer.
  try {
    engine.evaluate("1 litrr");
    throw new Error("should have thrown");
  } catch (e) {
    expect(e).toBeInstanceOf(NoCandidateError);
    expect((e as NoCandidateError).nearest).toContain("litre");
    expect((e as NoCandidateError).nearest).toContain("liter");
  }
});
