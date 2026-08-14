import { describe, expect, test } from "bun:test";
import { composeLocale, createEngine, Decimal } from "@smartput/core";
import { indonesian } from "@smartput/core/locale/id";
import { assertLocaleContract } from "@smartput/core/testing";
import { tempdelta, temperature } from "../index";
import temperatureEn from "./en";
import temperatureId from "./id";

const [readingId, deltaId] = temperatureId;
const [readingEn, deltaEn] = temperatureEn;

const locale = composeLocale(indonesian, temperatureId);
const engine = () => createEngine({ locales: [locale], kinds: [temperature, tempdelta] });

/**
 * The Indonesian words this file argues about, grepped for by name. A script regex
 * would catch nothing at all here: Indonesian is written in unaccented Latin, so it
 * looks exactly like a unit key to any character class — which is why `nl.test.ts`
 * could still reach for its tremas and this file cannot.
 */
const INDONESIAN = /derajat|selsius|suhu/i;

/** The closed key set `indonesian.selectForm` can produce. `en` has two, `uk` eight. */
const ONE_KEY = ["other"];

describe("temperature id vocabulary", () => {
  test("ships one vocabulary per kind in the package", () => {
    expect(temperatureId.map((v) => v.kind)).toEqual(["temperature", "tempdelta"]);
    for (const vocabulary of temperatureId) expect(vocabulary.locale).toBe("id");
  });

  test("covers every unit each kind declares", () => {
    const units = (k: typeof temperature) =>
      Object.keys(k.value.mode === "ratio" ? k.value.units : {}).sort();
    expect(Object.keys(readingId?.units ?? {}).sort()).toEqual(units(temperature));
    expect(Object.keys(deltaId?.units ?? {}).sort()).toEqual(units(tempdelta));
  });

  test("every unit has aliases and a symbol (R8)", () => {
    for (const vocabulary of temperatureId) {
      for (const [unit, words] of Object.entries(vocabulary.units)) {
        expect(
          words.aliases.length,
          `${vocabulary.kind}:${unit} has no aliases`,
        ).toBeGreaterThan(0);
        expect(words.symbol, `${vocabulary.kind}:${unit} has no symbol`).toBeDefined();
      }
    }
  });

  // Same reason as `en.test.ts`'s copy of this test: the two kinds answer to the same
  // words on purpose — that is what lets "20 C + 5 F" read its right operand as a
  // difference — and it is also what makes every temperature alias ambiguous, which
  // `print/unit-word.ts`'s ambiguity fallback is written against. Two lists that
  // drifted apart would silently disarm it.
  test("both kinds register the identical alias list", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(deltaId?.units[unit]?.aliases).toEqual(
        readingId?.units[unit]?.aliases ?? [],
      );
    }
  });

  // The finding this file exists to record: Indonesian adds no word, so the alias
  // lists are exactly the generated ones. Asserted against `en`'s rather than against
  // the table directly, because what is being claimed is "these two vocabularies
  // differ only in their tag" — which is a strong statement and should fail if either
  // side ever moves.
  test("adds no word, and every alias is the generated one", () => {
    for (const unit of ["c", "f", "k"]) {
      expect(readingId?.units[unit]?.aliases, unit).toEqual(
        readingEn?.units[unit]?.aliases ?? [],
      );
      expect(deltaId?.units[unit]?.aliases, unit).toEqual(
        deltaEn?.units[unit]?.aliases ?? [],
      );
      // The Latin half is reused from the one `ALIAS` map in `units.ts` rather than
      // retyped, so an Indonesian engine still reads "212 F".
      expect(readingId?.units[unit]?.aliases, unit).toContain(unit);
    }
    expect(readingId?.units.c?.aliases).toContain("celsius");
    expect(readingId?.units.f?.aliases).toContain("fahrenheit");
  });

  // The word that would have earned a line and cannot: *derajat* is Indonesian for
  // "degree" and it stands *before* the scale name, so "20 derajat Celsius" is two
  // word tokens and `lex` ends a word token at a space. Recorded as live assertions
  // rather than left in the doc comment, following `nl.test.ts`'s "graad" precedent:
  // an unclaimed word that reads as coverage is worse than a gap that is written down.
  test("derajat is a phrase, and the bare word belongs to angle", () => {
    const aliases = readingId?.units.c?.aliases ?? [];
    expect(aliases).not.toContain("derajat");
    // The phrase cannot be read — the alias index is keyed by one segmented word, and
    // Indonesian does not compound, so unlike Dutch there is no *celsiusderajat* to
    // fall back on either.
    expect(() => engine().evaluate("20 derajat celsius")).toThrow();
    expect(aliases.some((a) => a.includes("derajat"))).toBe(false);
    // And the bare word is left unclaimed rather than handed to whichever package was
    // written first: "45 derajat" is a slope at least as often as a temperature, and
    // no context either kind could offer separates them.
    expect(() => engine().evaluate("20 derajat")).toThrow();
  });

  // The measured half of the "selsius" decision, and the reason it is declined twice
  // over rather than once. The respelling already reads — the resolver corrects it to
  // the listed alias at a `FuzzyMatch` penalty — so an entry here would buy a
  // spelling the engine reaches anyway, at the price of an exact-match alias that
  // outranks the correction and hides that it was one.
  test("selsius reads through fuzzy correction, not through an alias", () => {
    expect(readingId?.units.c?.aliases).not.toContain("selsius");
    const e = engine();
    expect(e.evaluate("20 selsius").formatted).toBe("20°C");
    expect(e.evaluate("20 selsius").value?.unit).toBe("c");
    // Pinned as a *correction* and not merely as a reading, so that the day fuzzy
    // matching tightens, this fails here rather than going quiet: the candidate
    // carries the alias it was read as and the distance it cost.
    const [candidate] = e.explain("20 selsius").candidates;
    expect(candidate?.fuzzy?.alias).toBe("celsius");
    expect(candidate?.fuzzy?.distance).toBeGreaterThan(1);
  });

  // The per-unit decision is `en`'s, not re-taken here: the written form of this unit
  // is the symbol, and the spelled phrase is a phrase in this language as much as in
  // English. Asserting it against `en` rather than against `undefined` is what makes
  // the mirror the thing under test — if a later phase gives an English temperature
  // unit words, this fails until Indonesian follows.
  test("carries no forms on any unit, exactly as en carries none", () => {
    for (const [id, en] of [
      [readingId, readingEn],
      [deltaId, deltaEn],
    ] as const) {
      for (const unit of ["c", "f", "k"]) {
        expect(id?.units[unit]?.forms, `${id?.kind}:${unit}`).toBe(
          en?.units[unit]?.forms,
        );
        expect(id?.units[unit]?.forms, `${id?.kind}:${unit}`).toBeUndefined();
      }
    }
  });

  // The mirror of `en.test.ts`'s "the kinds themselves carry no English word": a kind
  // is ratios, offsets and unit ids, so no Indonesian word may reach it. A script
  // regex is useless in a shared, unaccented alphabet, so this greps for the words.
  test("the kinds themselves carry no Indonesian word", () => {
    for (const kind of [temperature, tempdelta]) {
      expect(JSON.stringify(kind)).not.toMatch(INDONESIAN);
    }
  });

  test("satisfies the locale contract", () => {
    expect(() => assertLocaleContract(locale, [temperature, tempdelta])).not.toThrow();
    // The default counts are all integers, so they never reach a fractional reading at
    // all. Under `id` a fraction cannot select a different key — there is only one —
    // and here it can only confirm the absence of a `forms` table besides, since a
    // unit with none is skipped before any key is asked for. That is the honest shape
    // of this kind's coverage, and running the same call every sibling row runs keeps
    // it comparable.
    expect(() =>
      assertLocaleContract(locale, [temperature, tempdelta], {
        counts: [0, 1, 2, 5, 11, 21, 100, 1000, 1.5],
      }),
    ).not.toThrow();
  });

  test("an engine built from it reads and writes Indonesian temperature", () => {
    const e = engine();
    // The plural boundary, and the point of a symbol-only kind: the output does *not*
    // move across it. Under `en` that is two keys collapsing to one printed string;
    // under `id` there is only ever one key, so the row is doubly empty.
    expect(e.evaluate("1 kelvin").formatted).toBe("1K");
    expect(e.evaluate("2 kelvin").formatted).toBe("2K");
    // The fractional row, with Indonesian's decimal comma — from CLDR, through
    // `numberFormat: "intl"`.
    expect(e.evaluate("1,5 kelvin").formatted).toBe("1,5K");
    // A conversion, read with each of Indonesian's two `in` words and printed in the
    // target scale. Both operands' words come from the shared table; the offsets come
    // from the kind.
    expect(e.evaluate("300 K ke celsius").formatted).toBe("26,85°C");
    expect(e.evaluate("212 F dalam C").formatted).toBe("100°C");
    // A conversion whose result groups. Indonesian groups with "." — which, unlike
    // Ukrainian's U+00A0, survives `normalize()`, so this row is round-tripped below
    // rather than merely asserted as a string.
    expect(e.evaluate("5000 C ke F").formatted).toBe("9.032°F");
    // The delta kind, reached through the same words and through this language's word
    // for subtraction: a difference between two readings is 10 degrees, not a reading
    // of 10 degrees.
    const diff = e.evaluate("30 celsius kurang 20 celsius");
    expect(diff.formatted).toBe("10°C");
    expect(diff.value?.kind).toBe("tempdelta");
    // A sum that lands on a fraction, through this language's word for addition.
    expect(e.evaluate("1 kelvin tambah 0,5 kelvin").formatted).toBe("1,5K");
  });

  // The one thing Indonesian changes about how a temperature is *written*, and it
  // comes from the language rather than from this file: `@smartput/core/locale/id`
  // declares no `renderQuantity`, so the default template applies and a symbol is set
  // tight. `nl` and `de` spend a sixth field to write "20 °C" with the SI space; this
  // package is the one place that field would have paid for itself, and Indonesian
  // typography does not ask for it.
  test("the symbol is tight, which is the default template and is also Indonesian", () => {
    expect(indonesian.renderQuantity).toBeUndefined();
    expect(engine().evaluate("20 C").formatted).toBe("20°C");
    expect(engine().evaluate("20 C").formatted).not.toBe("20 °C");
    // And it survives the trip back, which is the only reason it is safe to print:
    // `lex` skips "°" as an unrecognized character, so the reader sees the number and
    // then the bare "C" this table already claims.
    expect(engine().evaluate("20 °C").value?.canonical.toString()).toBe("20");
  });

  // `indonesian.selectForm` still answers for these units — it is a constant and
  // knows nothing about which units have tables — so the reason no grammar is
  // exercised here is the missing `forms`, not a missing key. Pinning that keeps the
  // previous tests honest: they assert output does not move across the plural
  // boundary, and this says why.
  test("selectForm produces one key this kind has no table to index", () => {
    const key = (count: number | undefined, slot: "after-number" | "conversion-target") =>
      indonesian.selectForm({
        ...(count !== undefined ? { count: new Decimal(count) } : {}),
        kind: "temperature",
        unit: "c",
        slot,
      });
    expect(
      [
        ...new Set([
          ...[1, 2, 5, 1.5].flatMap((c) => [
            key(c, "after-number"),
            key(c, "conversion-target"),
          ]),
          key(undefined, "conversion-target"),
        ]),
      ].sort(),
    ).toEqual(ONE_KEY);
    // The claim behind the one-key table, measured rather than asserted: CLDR gives
    // Indonesian exactly one plural category.
    expect(new Intl.PluralRules("id").resolvedOptions().pluralCategories).toEqual([
      "other",
    ]);
    expect(readingId?.units.c?.forms).toBeUndefined();
  });

  test("round-trips its own output", () => {
    const e = engine();
    // The grouped row is in this list where the Ukrainian file had to leave it out:
    // Indonesian groups with "." and `normalize()`'s NFKC pass leaves that alone, so
    // "9.032°F" reads back as one quantity — as does the decimal comma, an ordinary
    // ASCII character here and not Ukrainian's NBSP.
    for (const input of [
      "20 celsius",
      "1,5 kelvin",
      "100 fahrenheit",
      "300 K ke celsius",
      "5000 C ke F",
      "30 celsius kurang 20 celsius",
    ]) {
      const first = e.evaluate(input);
      const again = e.evaluate(first.formatted);
      expect(again.value?.unit, input).toBe(first.value?.unit);
      expect(again.value?.canonical.toFixed(20), input).toBe(
        first.value?.canonical.toFixed(20),
      );
    }
  });
});
