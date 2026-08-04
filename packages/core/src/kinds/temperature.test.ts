import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import { DimensionMismatchError } from "../errors";
import en from "../locale/en";
import { BUILTIN_KINDS } from "./index";
import { tempdelta, temperature } from "./temperature";

const engine = createEngine({
  locales: [en],
  kinds: [...BUILTIN_KINDS, temperature, tempdelta],
});

test("absolute conversion applies the offset", () => {
  const r = engine.evaluate("212 F in C");
  expect(r.kind).toBe("temperature");
  expect(r.value.canonical.toString()).toBe("100");
});

test("a bare reading is absolute, not a delta", () => {
  expect(engine.evaluate("20 C").kind).toBe("temperature");
});

test("adding two readings treats the right one as a difference", () => {
  const r = engine.evaluate("20 C + 5 C");
  expect(r.kind).toBe("temperature");
  expect(r.value.canonical.toString()).toBe("25");
  expect(r.meta.assumptions.length).toBeGreaterThan(0);
});

test("a Fahrenheit difference is converted as a difference, not a reading", () => {
  // 5F as a reading is -15C; as a difference it is 5 * 5/9 = 2.7777...C.
  const r = engine.evaluate("20 C + 5 F");
  // temperature+tempdelta (score -40) and tempdelta+tempdelta (score -50) both
  // land on 22.7778 here — tempdelta's ratios equal temperature's and no
  // offset applies to a difference — so the canonical value alone can't tell
  // the two apart. Asserting `kind` too is what actually pins down which
  // assignment won, the way its sibling above already does for "20 C + 5 C".
  expect(r.kind).toBe("temperature");
  expect(r.value.canonical.toFixed(4)).toBe("22.7778");
});

test("subtracting two readings yields a difference", () => {
  const r = engine.evaluate("30 C - 20 C");
  expect(r.kind).toBe("tempdelta");
  expect(r.value.canonical.toString()).toBe("10");
});

test("scaling an absolute temperature is always an error", () => {
  expect(() => engine.evaluate("20 C * 2")).toThrow(DimensionMismatchError);
});

test("dividing an absolute temperature is also always an error", () => {
  expect(() => engine.evaluate("20 C / 2")).toThrow(DimensionMismatchError);
});

test("scaling in the commuted order is also always an error", () => {
  // ratio-ops.ts generates ordinary kinds' `*` in both operand orders, so a
  // number-first "2 * 20 C" needs its own refusal — without it, temperature
  // never even appears as a candidate and tempdelta silently wins.
  expect(() => engine.evaluate("2 * 20 C")).toThrow(DimensionMismatchError);
});

test("the refusal error carries the source expression, not a blank placeholder", () => {
  let thrown: unknown;
  try {
    engine.evaluate("20 C * 2");
  } catch (e) {
    thrown = e;
  }
  expect(thrown).toBeInstanceOf(DimensionMismatchError);
  expect((thrown as DimensionMismatchError).input).toBe("20 C * 2");
});

test("scaling a difference is fine", () => {
  const r = engine.evaluate("30 C - 20 C");
  expect(r.value.canonical.toString()).toBe("10");
  const doubled = engine.evaluate("(30 C - 20 C) * 2");
  expect(doubled.kind).toBe("tempdelta");
  expect(doubled.value.canonical.toString()).toBe("20");
});

test("kelvin is offset-only", () => {
  expect(engine.evaluate("0 K in C").value.canonical.toFixed(2)).toBe("-273.15");
});
