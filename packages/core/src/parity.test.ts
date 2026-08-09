import { expect, test } from "bun:test";
import { english as en } from "@smartput/core/locale/en";
import { ukrainian as uk } from "@smartput/core/locale/uk";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import BUILTIN_UK from "@smartput/kinds/locale/uk";
import { createEngine } from "./engine";
import { composeLocale } from "./locale/compose";
import { DECLARED, DECLARED_COMPLETIONS, INPUTS, snapshot, UK_INPUTS } from "./parity";

/**
 * Two nets over the same code, one per language.
 *
 * The recorded fixture is the regression half: every public result, byte for
 * byte, so a change to an output has to arrive as a diff a reviewer approves.
 * The declared-column half below is the correctness one, and it is the half
 * that matters for a language nobody on the team reads at a glance — a
 * snapshot can only say "this did not change", never "this was right".
 */
const LANGUAGES = [
  {
    id: "en",
    engine: createEngine({
      locales: [composeLocale(en, BUILTIN_EN)],
      kinds: BUILTIN_KINDS,
    }),
    inputs: INPUTS,
  },
  {
    id: "uk",
    engine: createEngine({
      locales: [composeLocale(uk, BUILTIN_UK)],
      kinds: BUILTIN_KINDS,
    }),
    inputs: UK_INPUTS,
  },
] as const;

for (const { id, engine, inputs } of LANGUAGES) {
  const url = new URL(`../parity/${id}.json`, import.meta.url);
  const expected = (
    (await Bun.file(url).exists()) ? await Bun.file(url).json() : {}
  ) as Record<string, unknown>;

  test(`${id}: the parity fixture covers every corpus input`, () => {
    expect(Object.keys(expected).sort()).toEqual([...inputs].sort());
  });

  for (const input of inputs) {
    test(`parity ${id}: ${input}`, () => {
      expect(snapshot(engine, input)).toEqual(expected[input]);
    });
  }

  /**
   * The corpus's own columns, asserted rather than admired.
   *
   * Before this loop existed they were documentation: `INPUTS` read column 0
   * and nothing read the rest. All 36 English rows happened to be accurate,
   * but nothing was holding them there, and a Ukrainian corpus of unchecked
   * expectations would have been worse than none — it would have looked like
   * verification while blessing whatever the engine did on the day it was
   * written. Two rows in `uk.tsv` and one in `uk-complete.tsv` are marked
   * KNOWN WRONG in comments beside them for exactly this reason: they are
   * pinned here as what the engine currently does, with the grammar it should
   * produce written above them.
   */
  test(`${id}: every corpus row's declared kind, canonical and formatted`, () => {
    for (const row of DECLARED[id]) {
      const r = engine.evaluate(row.input);
      expect(
        {
          kind: r.kind,
          canonical: r.value.canonical.toString(),
          formatted: r.formatted,
        },
        row.input,
      ).toEqual({
        kind: row.kind,
        canonical: row.canonical,
        formatted: row.formatted,
      });
    }
  });

  test(`${id}: every completion row's declared kind, unit and text`, () => {
    for (const row of DECLARED_COMPLETIONS[id]) {
      const first = engine.complete(row.input)[0];
      expect(first, `${row.input} offered nothing`).toBeDefined();
      expect(
        { kind: first?.kind, unit: first?.unit, text: first?.text },
        row.input,
      ).toEqual({
        kind: row.kind,
        unit: row.unit,
        text: row.text,
      });
    }
  });
}

/**
 * The corpora are translations, not transliterations, and this is the
 * assertion that keeps them from silently becoming the same file. Ukrainian's
 * rows exist to exercise what English cannot express — four plural categories,
 * a decimal comma, fused hundreds — so an overlap beyond the handful of rows
 * that are pure arithmetic would mean somebody transliterated instead.
 */
test("the two corpora are translations, not copies", () => {
  const shared = INPUTS.filter((i) => UK_INPUTS.includes(i));
  // Exactly three, and each one is a row with no word in it at all: bare
  // arithmetic, two temperature symbols that are Latin in both languages, and a
  // percent sign. There is nothing to translate in any of them, so they are the
  // same string in both files by necessity rather than by copying — and the two
  // engines still answer them differently, since Ukrainian formats "9" and
  // "10°C" with its own number grammar.
  expect(shared).toEqual(["(1 + 2) * 3", "30 C - 20 C", "50 + 20%"]);
});
