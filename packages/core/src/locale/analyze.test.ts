import { expect, test } from "bun:test";
import { english } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { createEngine } from "../engine";
import { NoCandidateError } from "../errors";
import type { Analyzer } from "../types";
import { createAnalyzerChain } from "./analyze";
import { composeLocale } from "./compose";
import { defineLanguage } from "./define";
import { identity, suffixStripper, tableAnalyzer } from "./helpers";

const uk = defineLanguage({
  id: "uk",
  numberFormat: "intl",
  analyze: [identity(), suffixStripper({ suffixes: ["ів"], minStem: 3, weight: -2 })],
  keywords: { in: ["в"] },
  selectForm: () => "other",
});

test("the chain returns every analyzer's forms, exact match first", () => {
  const analyze = createAnalyzerChain(uk);
  expect(analyze("кілограмів")).toEqual([
    { form: "кілограмів", weight: 0 },
    { form: "кілограм", weight: -2 },
  ]);
});

test("duplicate forms keep the highest weight only", () => {
  const locale = defineLanguage({
    id: "uk",
    numberFormat: "intl",
    analyze: [identity(), tableAnalyzer({ кг: "кг" }, -5)],
    keywords: {},
    selectForm: () => "other",
  });
  expect(createAnalyzerChain(locale)("кг")).toEqual([{ form: "кг", weight: 0 }]);
});

test("results are memoized: the same surface is analyzed once", () => {
  let calls = 0;
  const counting = defineLanguage({
    id: "uk",
    numberFormat: "intl",
    analyze: [
      (s) => {
        calls += 1;
        return [{ form: s, weight: 0 }];
      },
    ],
    keywords: {},
    selectForm: () => "other",
  });
  const analyze = createAnalyzerChain(counting);
  analyze("кг");
  analyze("кг");
  expect(calls).toBe(1);
});

test("a locale with no analyzers still returns the surface form", () => {
  const bare = defineLanguage({
    id: "en",
    numberFormat: "intl",
    keywords: {},
    selectForm: () => "other",
  });
  expect(createAnalyzerChain(bare)("kg")).toEqual([{ form: "kg", weight: 0 }]);
});

/**
 * A language whose whole analyzer chain is one spy, recording the run it was
 * given. `weight: 0` and the surface as its own form, so the spy is
 * substitutable for `identity()` and installing it changes no reading.
 */
const spying = (seen: Array<{ words: readonly string[]; index: number }>) =>
  defineLanguage({
    id: "en",
    numberFormat: "intl",
    analyze: [
      (surface, ctx) => {
        seen.push({ words: ctx.words, index: ctx.index });
        return [{ form: surface, weight: 0 }];
      },
    ],
    keywords: {},
    selectForm: () => "other",
  });

test("an analyzer can see its neighbours", () => {
  const seen: Array<{ words: readonly string[]; index: number }> = [];
  createAnalyzerChain(spying(seen))("metres", { words: ["square", "metres"], index: 1 });
  expect(seen[0]).toEqual({ words: ["square", "metres"], index: 1 });
});

test("a chain called with no run at all still works", () => {
  const chain = createAnalyzerChain(english);
  expect(chain("kilograms").some((f) => f.form === "kilogram")).toBe(true);
});

/**
 * The degenerate run, which is what makes the widening a widening: an analyzer
 * written against `ctx.words` reads the same thing whether or not its caller
 * knows about runs, and never has to test for absence.
 */
test("a chain called with no run sees the surface as its own one-word run", () => {
  const seen: Array<{ words: readonly string[]; index: number }> = [];
  createAnalyzerChain(spying(seen))("kg");
  expect(seen[0]).toEqual({ words: ["kg"], index: 0 });
});

/**
 * The failure this test exists for is silent: one word, analyzed once, its
 * answer handed to every later position of the same word. Nothing throws and
 * no count goes wrong — the second "metres" simply gets the first one's
 * reading, which is right until an analyzer reads a neighbour and then is
 * wrong for the rest of the process's life.
 */
test("the memo is per position and per run, not per surface", () => {
  const seen: Array<{ words: readonly string[]; index: number }> = [];
  // Answers with the run it was given, so a poisoned entry is visible as a
  // form rather than having to be inferred from a call count.
  const positional: Analyzer = (_surface, ctx) => {
    seen.push({ words: ctx.words, index: ctx.index });
    return [{ form: `${ctx.index}:${ctx.words.join("+")}`, weight: 0 }];
  };
  const chain = createAnalyzerChain(
    defineLanguage({
      id: "en",
      numberFormat: "intl",
      analyze: [positional],
      keywords: {},
      selectForm: () => "other",
    }),
  );

  const first = chain("metres", { words: ["square", "metres"], index: 1 });
  const second = chain("metres", { words: ["metres", "wide"], index: 0 });
  const third = chain("metres", { words: ["cubic", "metres"], index: 1 });
  const alone = chain("metres");

  expect(first[0]?.form).toBe("1:square+metres");
  expect(second[0]?.form).toBe("0:metres+wide");
  expect(third[0]?.form).toBe("1:cubic+metres");
  expect(alone[0]?.form).toBe("0:metres");

  // Four distinct questions, four analyzer calls — and then not one more,
  // because each is memoized under its own key.
  expect(seen).toHaveLength(4);
  chain("metres", { words: ["square", "metres"], index: 1 });
  chain("metres");
  expect(seen).toHaveLength(4);
});

/**
 * The common path, which is every input with no multi-word run in it: one
 * entry per distinct word, exactly as before Task 19. The cache is a closure
 * variable with no accessor, so the observable consequence is the count of
 * analyzer calls — a bare surface must never be re-analyzed, and must never be
 * answered from a *positioned* entry either.
 */
test("a run-less call keeps the one-entry-per-word cache", () => {
  const seen: Array<{ words: readonly string[]; index: number }> = [];
  const chain = createAnalyzerChain(spying(seen));
  chain("kg");
  chain("kg");
  chain("kg");
  expect(seen).toHaveLength(1);
  // A positioned call for the same word is a different question, and answering
  // it from the bare entry is the poisoning this key split prevents.
  chain("kg", { words: ["kg", "kg"], index: 1 });
  expect(seen).toHaveLength(2);
});

/**
 * The run through the real engine, which is the only place it can be shown to
 * arrive: `lex` records it, three fold passes rebuild the token array, and
 * `pratt` asks the resolver about a word that by then has no index of its own.
 * A chain test proves the parameter exists; only this proves it is passed.
 *
 * The runs asserted here are also the honest measurement of what P5 has so far
 * made *reachable*, and it is narrower than "any phrase". A neighbour that
 * survives as a word of its own ends the parse: "5 square metres" reaches the
 * analyzers with its run intact and still throws, because "square" is nobody's
 * alias and `pratt` consumes one word per quantity. The neighbours visible to
 * an input that *evaluates* are the ones a later fold absorbed — a spelled
 * numeral here — which is a consequence of recording runs before the folds
 * rather than after. Task 20's `phraseAnalyzer` therefore needs a parser that
 * lets one reading consume several words; an analyzer alone will not do it.
 */
test("the run reaches an analyzer through a real engine", () => {
  const seen: Array<{ words: readonly string[]; index: number }> = [];
  const engine = createEngine({
    locales: [
      composeLocale(
        defineLanguage({
          ...english,
          analyze: [
            identity(),
            (_surface, ctx) => {
              if (ctx.words.length > 1) seen.push({ words: ctx.words, index: ctx.index });
              return [];
            },
          ],
        }),
        BUILTIN_EN,
      ),
    ],
    kinds: BUILTIN_KINDS,
  });

  expect(engine.evaluate("5 kg").formatted).toBe("5 kilograms");
  expect(seen).toEqual([]);

  // The words the numeral fold ate are still neighbours: the run is what was
  // typed, not what survived.
  expect(engine.evaluate("twenty two kg").formatted).toBe("22 kilograms");
  expect(seen).toEqual([{ words: ["twenty", "two", "kg"], index: 2 }]);

  seen.length = 0;
  expect(() => engine.evaluate("5 square metres")).toThrow(NoCandidateError);
  expect(seen).toEqual([{ words: ["square", "metres"], index: 0 }]);
});

/**
 * And the run is load-bearing, not merely delivered: an analyzer that reads it
 * moves the answer of a real `evaluate`. The reading is nonsense as English —
 * that is deliberate, since no built-in vocabulary has a phrase to test with
 * and inventing one would test the vocabulary rather than the wiring.
 */
test("a run-reading analyzer changes what a real engine answers", () => {
  const engine = createEngine({
    locales: [
      composeLocale(
        defineLanguage({
          ...english,
          analyze: [
            identity(),
            (surface, ctx) =>
              surface === "kg" && ctx.words[0] === "twenty"
                ? [{ form: "g", weight: 5 }]
                : [],
          ],
        }),
        BUILTIN_EN,
      ),
    ],
    kinds: BUILTIN_KINDS,
  });

  // No run, so the analyzer declines and "kg" is a kilogram.
  expect(engine.evaluate("22 kg").formatted).toBe("22 kilograms");
  // Same word, same engine, same count — read as grams because of what stands
  // beside it.
  expect(engine.evaluate("twenty two kg").formatted).toBe("22 grams");
});
