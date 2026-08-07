import { expect, test } from "bun:test";
import { composeLocale, createEngine, type Engine } from "@smartput/core";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { english as en } from "@smartput/locale-en";
import { BOOLEAN_UNIT, boolean } from "./index";

const engine: Engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

/**
 * `boolean` is the one kind in the built-in set that ships **no vocabulary**,
 * and these are the two halves of why that is safe.
 *
 * Its single unit is a sentinel: `"true"` and `"false"` are produced by the
 * kind's own `format` hook, never by a unit word, and the unit itself is
 * unreachable from typed text because nothing registers a word for it. So
 * there is nothing for an English vocabulary to hold — moving an empty alias
 * list into `src/locale/en.ts` would be moving nothing, and would put a file
 * in the tree implying a translator has work to do here. They do not.
 */
test("the kind names its unit by id and carries no words at all (R1)", () => {
  expect(boolean.value.mode).toBe("opaque");
  const units = boolean.value.mode === "opaque" ? boolean.value.units : undefined;
  expect(units).toEqual([BOOLEAN_UNIT]);
  // No `aliases`, no `symbol`, no `lexicon` — the shape the record form carried.
  expect(JSON.stringify(boolean)).not.toMatch(/aliases|symbol|lexicon/);
});

/**
 * The behaviour the move must not disturb: a comparison still evaluates, and
 * still *prints* through `format`, with no unit word anywhere near it.
 */
test("a comparison still formats as true", () => {
  expect(engine.evaluate("1 kg > 500 g").formatted).toBe("true");
  expect(engine.evaluate("500 g > 1 kg").formatted).toBe("false");
});
