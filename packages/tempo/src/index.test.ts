import { expect, test } from "bun:test";
import { composeLocale, createEngine, DivideByZeroError } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";
import { tempo } from "./index";

// The barrel is here for `duration` — the other side of the bridge, which this
// package names by string and does not depend on. `tempo` itself is spliced in
// from source rather than read off the barrel so this file passes before the
// wiring lands, and filtered out of the barrel so it still passes after: pass 1
// of `buildRegistry` rejects a kind id registered twice, and a test that breaks
// the moment the barrel gains the kind is a test nobody trusts.
const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: [...BUILTIN_KINDS.filter((k) => k.id !== "tempo"), tempo],
});

test("a tempo is a ratio kind over its own two units", () => {
  expect(engine.evaluate("1 hz in bpm").value.canonical.toString()).toBe("60");
  expect(engine.evaluate("120 bpm + 1 hz in bpm").formatted).toBe("180 bpm");
});

test("a tempo converts to the duration of one beat", () => {
  const r = engine.evaluate("120 bpm in ms");
  expect(r.kind).toBe("duration");
  expect(r.value.unit).toBe("ms");
  // Canonical is seconds whatever the target unit; `formatted` is what shows
  // the 500 the question was actually about.
  expect(r.value.canonical.toString()).toBe("0.5");
  expect(r.formatted).toBe("500 milliseconds");
});

test("a duration converts back to the tempo it is one beat of", () => {
  const r = engine.evaluate("500 ms in bpm");
  expect(r.kind).toBe("tempo");
  expect(r.value.unit).toBe("bpm");
  expect(r.value.canonical.toString()).toBe("120");
  expect(r.formatted).toBe("120 bpm");
});

test("the bridge is reciprocal, not linear", () => {
  // Halving the tempo doubles the beat. A ratio row could not express this,
  // which is why the two directions are `in` signatures.
  expect(engine.evaluate("60 bpm in ms").value.canonical.toString()).toBe("1");
  expect(engine.evaluate("240 bpm in ms").value.canonical.toString()).toBe("0.25");
});

test("the round trip lands on the tempo it started from", () => {
  for (const bpm of [40, 90, 120, 128, 220]) {
    const period = engine.evaluate(`${bpm} bpm in s`);
    const back = engine.evaluate(`${period.value.canonical.toString()} s in bpm`);
    expect(back.value.canonical.toNumber(), `${bpm}`).toBeCloseTo(bpm, 9);
  }
});

test("a zero on either side is a division by zero, not Infinity", () => {
  // decimal.js answers x/0 with Infinity, so without the guard these formatted
  // as "Infinity milliseconds". `120 bpm / 0` already raises this error, and
  // the two spellings of the same division should not disagree.
  expect(() => engine.evaluate("0 bpm in ms")).toThrow(DivideByZeroError);
  expect(() => engine.evaluate("0 s in bpm")).toThrow(DivideByZeroError);
});

test("the result unit comes from the right operand, not the canonical", () => {
  // The generated `in|id|id` sources the result from `r`; these two do the
  // same, so the target unit survives even though the arithmetic is the left
  // operand's alone.
  expect(engine.evaluate("120 bpm in s").value.unit).toBe("s");
  expect(engine.evaluate("120 bpm in min").value.unit).toBe("min");
  expect(engine.evaluate("2 s in hz").value.unit).toBe("hz");
});
