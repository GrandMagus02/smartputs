import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import { NoCandidateError } from "../errors";
import { defineKind } from "../kind/define";
import { buildRegistry } from "../kind/registry";
import { createResolver } from "../parse/candidates";
import type { AnalyzeCtx } from "../types";
import { composeLocale } from "./compose";
import { defineLanguage } from "./define";
import { identity, suffixStripper } from "./helpers";
import { prefixStripper } from "./prefix-stripper";
import { defineVocabulary } from "./vocabulary";

/**
 * The degenerate run `createAnalyzerChain` builds for a caller that supplies
 * no position — the word alone, at index 0. `prefixStripper` never reads it
 * (it is a pure string operation on the surface), but `AnalyzeCtx` requires
 * it, so the fixture supplies it the same way `helpers.test.ts` does.
 */
const ctx = (surface: string): AnalyzeCtx => ({
  locale: "sw",
  words: [surface],
  index: 0,
});

test("prefixStripper offers each strippable prefix at a penalty", () => {
  const a = prefixStripper({ prefixes: ["ki", "vi"], minStem: 4, weight: -2 });
  expect(a("kimita", ctx("kimita"))).toEqual([{ form: "mita", weight: -2 }]);
});

test("prefixStripper defaults to a -2 penalty, like suffixStripper", () => {
  const a = prefixStripper({ prefixes: ["ki"], minStem: 4 });
  expect(a("kimita", ctx("kimita"))).toEqual([{ form: "mita", weight: -2 }]);
});

test("prefixStripper offers a longer prefix before a shorter one", () => {
  // Declared shortest-first on purpose: the ordering is the helper's, not the
  // caller's. Both stems are offered — the chain resolves which one names a
  // unit — but the longer strip comes first, as suffixStripper's does.
  const a = prefixStripper({ prefixes: ["ki", "kiwa"], minStem: 3, weight: -2 });
  expect(a("kiwamita", ctx("kiwamita"))).toEqual([
    { form: "mita", weight: -2 },
    { form: "wamita", weight: -2 },
  ]);
});

test("prefixStripper respects minStem", () => {
  const a = prefixStripper({ prefixes: ["ki"], minStem: 5, weight: -2 });
  expect(a("kimita", ctx("kimita"))).toEqual([]);
});

test("prefixStripper never returns an empty stem", () => {
  const a = prefixStripper({ prefixes: ["ki"], minStem: 0, weight: -2 });
  expect(a("ki", ctx("ki"))).toEqual([]);
});

test("prefixStripper will not claim a prefix that is not at the start", () => {
  // The one refusal that separates a prefix stripper from a substring search:
  // "ki" is in "mkiwa" twice over as a substring, and neither occurrence is a
  // prefix, so nothing is offered.
  const a = prefixStripper({ prefixes: ["ki"], minStem: 2, weight: -2 });
  expect(a("mkiwa", ctx("mkiwa"))).toEqual([]);
  expect(a("waki", ctx("waki"))).toEqual([]);
});

test("prefixStripper holds nothing between calls and leaves the caller's array alone", () => {
  const prefixes = ["ki", "kiwa"];
  const a = prefixStripper({ prefixes, minStem: 3, weight: -2 });
  // The sort is over a copy: a caller who reads its own array back after
  // building the analyzer sees the order it wrote.
  expect(prefixes).toEqual(["ki", "kiwa"]);
  const first = a("kimita", ctx("kimita"));
  first.length = 0; // the caller mutating what it was handed
  expect(a("kimita", ctx("kimita"))).toEqual([{ form: "mita", weight: -2 }]);
});

// --- against a real engine -------------------------------------------------
//
// A helper that passes the seven assertions above and still cannot move a word
// through the engine has proved nothing: the chain folds every analyzer's
// output, weighs it against the exact-alias reading, and hands the survivors
// to the solver. Everything below is measured through that, not around it.

const length = defineKind({
  id: "length",
  value: { mode: "ratio", canonical: "m", units: { m: 1, km: 1000 } },
});

/**
 * A deliberately invented agglutinative language — `sw` is a real ISO code but
 * this is a two-word fixture, not Swahili, and spec §13 keeps any third
 * shipped language out of scope. `km`'s only word is `mita` under the noun
 * class prefix the stripper is given, which is the whole point: `kimita` is
 * both `km`'s exact alias and `m`'s alias with `ki` stripped off, so the two
 * readings collide by construction and the penalty has to break the tie.
 */
const swahili = (opts: { minStem: number; prefixes?: string[]; suffixes?: string[] }) =>
  composeLocale(
    defineLanguage({
      id: "sw",
      numberFormat: "intl",
      keywords: {},
      selectForm: () => "other",
      analyze: [
        identity(),
        prefixStripper({ prefixes: opts.prefixes ?? ["ki"], minStem: opts.minStem }),
        ...(opts.suffixes === undefined
          ? []
          : [suffixStripper({ suffixes: opts.suffixes, minStem: opts.minStem })]),
      ],
    }),
    [
      defineVocabulary({
        locale: "sw",
        kind: "length",
        units: { m: { aliases: ["mita"] }, km: { aliases: ["kimita"] } },
      }),
    ],
  );

const engineFor = (locale: ReturnType<typeof swahili>) =>
  createEngine({ locales: [locale], kinds: [length] });

const resolverFor = (locale: ReturnType<typeof swahili>) =>
  createResolver({
    registry: buildRegistry([length], [locale]),
    locales: [locale],
    format: locale,
    layers: [],
  });

test("prefixStripper (engine): a prefixed word reaches the unit its stem names", () => {
  // `viwamita` is in no vocabulary at all. It reads only because the stripper
  // offered `mita`, and the engine printed the metre it names.
  const engine = engineFor(swahili({ minStem: 4, prefixes: ["ki", "viwa"] }));
  const result = engine.evaluate("5 viwamita");
  expect(result.value).toMatchObject({ kind: "length", unit: "m" });
  expect(result.formatted).toBe("5 m");
});

test("prefixStripper (engine): an exact alias outranks the same word stripped", () => {
  const locale = swahili({ minStem: 4 });
  const [best, ...rest] = resolverFor(locale).resolve("kimita");
  // Both readings are on the table — this is the collision the fixture was
  // built to produce — and the exact one wins by exactly the stripper's
  // penalty, which is what makes the negative default weight load-bearing
  // rather than decorative.
  expect(best).toMatchObject({ unit: "km", form: "kimita", analyzerWeight: 0 });
  expect(rest.map((c) => c.unit)).toEqual(["m"]);
  expect(rest[0]?.analyzerWeight).toBe(-2);
  expect((best?.weight ?? 0) - (rest[0]?.weight ?? 0)).toBe(2);
  expect(engineFor(locale).evaluate("5 kimita").value).toMatchObject({ unit: "km" });
});

test("prefixStripper (engine): minStem prunes the reading, it does not merely reorder it", () => {
  // One character higher than the stem `ki` leaves behind, and the second
  // candidate is gone from the engine entirely — not demoted, absent.
  const [only, ...rest] = resolverFor(swahili({ minStem: 5 })).resolve("kimita");
  expect(only).toMatchObject({ unit: "km" });
  expect(rest).toEqual([]);
});

test("prefixStripper (engine): a prefix and a suffix stripper do not compose", () => {
  // The documented consequence of `createAnalyzerChain` running every analyzer
  // over the *original* surface. Either end comes off on its own — `viwamita`
  // strips to `mita`, and so does `mitani` — but `viwamitani` strips only to
  // `mitani` and to `viwamita`, neither of which is a word this vocabulary
  // knows, so it reads as nothing at all.
  const engine = engineFor(swahili({ minStem: 4, prefixes: ["viwa"], suffixes: ["ni"] }));
  expect(engine.evaluate("5 viwamita").value).toMatchObject({ unit: "m" });
  expect(engine.evaluate("5 mitani").value).toMatchObject({ unit: "m" });
  expect(() => engine.evaluate("5 viwamitani")).toThrow(NoCandidateError);
});

test("prefixStripper (engine): matching is case-sensitive, and the fix is a second entry", () => {
  // Worth a test rather than a footnote, because a prefix sits exactly where
  // sentence capitalisation lands — the one place a suffix never does. The
  // analyzer chain is handed the surface as typed (`candidates.ts` folds the
  // *form* an analyzer returns, on the way to the alias index, not the surface
  // on the way in), so `Viwa` is not `viwa` and the strip does not happen.
  // `Viwamita` is not an alias in any casing, so nothing else catches it.
  const plain = engineFor(swahili({ minStem: 4, prefixes: ["viwa"] }));
  expect(plain.evaluate("5 viwamita").value).toMatchObject({ unit: "m" });
  expect(() => plain.evaluate("5 Viwamita")).toThrow(NoCandidateError);

  const cased = engineFor(swahili({ minStem: 4, prefixes: ["viwa", "Viwa"] }));
  expect(cased.evaluate("5 Viwamita").value).toMatchObject({ unit: "m" });
});
