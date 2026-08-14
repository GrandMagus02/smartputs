import { expect, test } from "bun:test";
import type { Vocabulary } from "@smartput/core";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { english } from "@smartput/core/locale/en";
import { polish } from "@smartput/core/locale/pl";
import { assertLocaleContract } from "@smartput/core/testing";
import datetimePl from "@smartput/datetime/locale/pl";
import measurePl from "@smartput/measure/locale/pl";
import ratePl from "@smartput/rate/locale/pl";
import { BUILTIN_KINDS } from "./index";
import BUILTIN_EN from "./locale/en";
import BUILTIN_PL from "./locale/pl";

/**
 * What no single kind's `locale/pl.test.ts` can see.
 *
 * Each of those files builds an engine over **one** kind, which is the right
 * scope for asking whether a paradigm is correct Polish and the wrong scope for
 * asking whether it collides with anything. `buildRegistry`'s alias index is one
 * flat map with no kind in the key, so a surface two kinds both claim is only
 * ambiguous in an engine that installs both — and `@smartput/kinds` is the
 * package that installs both. This file is that engine.
 *
 * It found one: `energy:cal`'s international symbol against `length:in`'s
 * `nom-one` "cal", the ordinary Polish word for the inch. Every per-kind suite
 * was green while `evaluate("1 cal")` threw `AmbiguityError` on a string the
 * length vocabulary itself prints. `@smartput/energy/locale/pl`'s `RESERVED` is
 * where that is settled; the test below is what would notice it coming back.
 */
const ALL: readonly Vocabulary[] = [...BUILTIN_PL, measurePl, datetimePl, ratePl];

/** Exactly what `polish.selectForm` can produce: {nom, loc} × CLDR's four. */
const EIGHT_KEYS = [
  "loc-few",
  "loc-many",
  "loc-one",
  "loc-other",
  "nom-few",
  "nom-many",
  "nom-one",
  "nom-other",
];

/**
 * `boolean:bool` has no words in any language — `en` skips it too — and
 * `power:w`'s symbol "W" folds onto "w", which is this language's conversion
 * keyword and therefore a token no alias index can claim. That second one is
 * English `length:in` exactly, it is what `skipPrintable` was added for, and
 * `@smartput/power/locale/pl` argues it at length.
 */
const SKIP = ["boolean:bool"];
const SKIP_PRINTABLE = ["power:w"];

test("the whole pl locale satisfies the contract, fractional counts included", () => {
  const locale = composeLocale(polish, BUILTIN_PL);
  assertLocaleContract(locale, BUILTIN_KINDS, {
    skip: SKIP,
    skipPrintable: SKIP_PRINTABLE,
  });
  // The default counts are all integers, so they never ask for the `other`
  // category at all — and in Polish `other` is the *fractional* row, a genitive
  // singular that no other sample can reach. 21 and 101 are here for the
  // opposite reason: they are `many` in Polish and `one` in Ukrainian, so a
  // table ported from `uk` fails precisely on them.
  assertLocaleContract(locale, BUILTIN_KINDS, {
    skip: SKIP,
    skipPrintable: SKIP_PRINTABLE,
    counts: [0, 1, 2, 5, 11, 21, 22, 100, 101, 1000, 0.5, 1.5, 2.5],
  });
});

test("every pl forms table is keyed by exactly the eight", () => {
  // A missing key renders `undefined` at a user and throws nothing; an extra one
  // is dead weight that hides a typo in a real row. Both are silent, which is
  // why they are asserted on the key *set* rather than on a lookup.
  const wrong: string[] = [];
  for (const v of ALL) {
    for (const [unit, words] of Object.entries(v.units)) {
      if (words.forms === undefined) continue;
      const keys = Object.keys(words.forms).sort();
      if (JSON.stringify(keys) !== JSON.stringify(EIGHT_KEYS)) {
        wrong.push(`${v.kind}:${unit} -> ${JSON.stringify(keys)}`);
      }
    }
  }
  expect(wrong).toEqual([]);
});

test("polish.selectForm produces exactly the eight and nothing else", () => {
  // The other half of the contract above: a table with the eight keys is only
  // right if the eight are also all the language can ask for. Swept rather than
  // sampled, because the CLDR boundary this language is likeliest to be wrong
  // about (21 is `many`, 22 is `few`) is a property of a residue class.
  const seen = new Set<string>();
  for (const slot of ["bare", "after-number", "conversion-target", "unknown-slot"]) {
    seen.add(polish.selectForm({ kind: "mass", unit: "kg", slot }));
    for (let n = 0; n <= 2200; n += 1) {
      seen.add(
        polish.selectForm({ count: new Decimal(n), kind: "mass", unit: "kg", slot }),
      );
    }
    for (const f of [0.1, 0.5, 1.5, 2.5, 5.5, 21.5, 100.25]) {
      seen.add(
        polish.selectForm({ count: new Decimal(f), kind: "mass", unit: "kg", slot }),
      );
    }
  }
  expect([...seen].sort()).toEqual(EIGHT_KEYS);
});

test("every form a pl vocabulary prints is a form it reads", () => {
  // The containment `packages/mass/src/locale/uk.test.ts` documents: a printed
  // form that is not a listed alias still round-trips, because `polish`'s suffix
  // stripper recovers it — at `weight: -2`, a guess rather than a reading. This
  // asserts it across every kind at once, including the three that are not in
  // the `BUILTIN_PL` barrel.
  const missing: string[] = [];
  for (const v of ALL) {
    for (const [unit, words] of Object.entries(v.units)) {
      for (const [key, form] of Object.entries(words.forms ?? {})) {
        if (!words.aliases.includes(form)) {
          missing.push(`${v.kind}:${unit} prints ${key}="${form}" but does not list it`);
        }
      }
    }
  }
  expect(missing).toEqual([]);
});

/**
 * Feed a language its own output, over every surface every unit can be written
 * as — the symbol *and* all eight printed forms, because the word path is the
 * ordinary one and the symbol path is the opt-in one, so probing the symbol
 * alone misses the commoner failure.
 *
 * Run over `en` as well and reported as a difference, so what comes back is what
 * this translation broke rather than what the engine has always done: "1 m" is
 * ambiguous between `duration:min` and `length:m` in English too, and no Polish
 * vocabulary should be blamed for it.
 */
function roundTripFailures(
  language: typeof polish,
  vocabularies: readonly Vocabulary[],
  decimal: string,
): string[] {
  const engine = createEngine({
    locales: [composeLocale(language, vocabularies)],
    kinds: BUILTIN_KINDS,
  });
  // A thrown `AmbiguityError` is a failure to be collected, not one to abort on:
  // half a report is how a translator fixes one collision per run.
  const evaluate = (source: string) => {
    try {
      return engine.evaluate(source);
    } catch {
      return { value: undefined, formatted: "" };
    }
  };
  const failures: string[] = [];
  for (const v of vocabularies) {
    for (const [unit, words] of Object.entries(v.units)) {
      const labels = new Set([words.symbol ?? unit, ...Object.values(words.forms ?? {})]);
      for (const label of labels) {
        for (const n of ["1", "2", "5", "21", `1${decimal}5`, "2500", "1234567"]) {
          const first = evaluate(`${n} ${label}`);
          if (first.value === undefined) {
            failures.push(`${v.kind}:${unit} cannot read ${JSON.stringify(label)}`);
            continue;
          }
          const printed = first.formatted;
          const again = evaluate(printed);
          if (again.value === undefined) {
            failures.push(`${v.kind}:${unit} printed ${JSON.stringify(printed)}, unread`);
          } else if (again.value.unit !== first.value.unit) {
            failures.push(
              `${v.kind}:${unit} printed ${JSON.stringify(printed)} -> ${again.value.unit}`,
            );
          } else if (
            again.value.canonical.toFixed(20) !== first.value.canonical.toFixed(20)
          ) {
            failures.push(`${v.kind}:${unit} printed ${JSON.stringify(printed)}, moved`);
          }
        }
      }
    }
  }
  return failures;
}

test("a pl engine reads back everything it writes, no worse than en", () => {
  // The grouped magnitudes are in the sample on purpose. Polish groups thousands
  // with U+00A0 and `parse/normalize.ts` folds every `\s` — NBSP included — to a
  // plain space before `lex()` sees it, so "1 234 567 gramów" would come back as
  // three numbers. `lex` accepts the folded separator when the language's own
  // group separator is a non-breaking space, which is the accommodation
  // Ukrainian needed first and Polish inherits unchanged.
  const plFailures = roundTripFailures(polish, BUILTIN_PL, ",");
  const enFailures = new Set(roundTripFailures(english, BUILTIN_EN, "."));
  const enUnits = new Set([...enFailures].map((line) => line.split(" ")[0]));
  const novel = plFailures.filter(
    (line) =>
      !enFailures.has(line) &&
      !enUnits.has(line.split(" ")[0] as string) &&
      // `power:w`, for the reason `SKIP_PRINTABLE` gives.
      !line.startsWith("power:w"),
  );
  expect(novel).toEqual([]);
});

test('the Polish inch keeps "cal" against the calorie', () => {
  // The regression `@smartput/energy/locale/pl`'s `RESERVED` exists for, asserted
  // in the only engine that can see it. "cal" is the inch in ordinary Polish and
  // the calorie's international symbol; the inch keeps the surface because it is
  // the one that *prints* it, and the calorie keeps `kaloria`, which is a word
  // no other kind claims.
  const engine = createEngine({
    locales: [composeLocale(polish, BUILTIN_PL)],
    kinds: BUILTIN_KINDS,
  });
  expect(engine.evaluate("1 cal").value?.kind).toBe("length");
  expect(engine.evaluate("2,54 cm w calach").formatted).toBe("1 cal");
  expect(engine.evaluate("5 kalorii").value?.unit).toBe("cal");
  expect(engine.evaluate("5 kcal").formatted).toBe("5 kilokalorii");
});

test("no kind carries a Polish word", () => {
  // The mirror of every `pl.test.ts`'s per-kind check, swept over the barrel: a
  // kind is ratios, unit ids and magnitude bands, so a Polish diacritic anywhere
  // in a descriptor means a translation leaked into the language-free half.
  const leaked = BUILTIN_KINDS.filter((kind) =>
    /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(JSON.stringify(kind)),
  ).map((kind) => kind.id);
  expect(leaked).toEqual([]);
});
