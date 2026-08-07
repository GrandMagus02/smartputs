import { expect, test } from "bun:test";
import {
  composeLocale,
  createEngine,
  Decimal,
  DimensionMismatchError,
  type EvalCtx,
  type Value,
} from "@smartput/core";
import en from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import { percent } from "./index";

const engine = createEngine({ locales: [composeLocale(en)], kinds: BUILTIN_KINDS });

test("a bare percentage is a ratio", () => {
  const r = engine.evaluate("20%");
  expect(r.kind).toBe("percent");
  expect(r.value.canonical.toString()).toBe("0.2");
});

test("percent of a number", () => {
  const r = engine.evaluate("20% of 50");
  expect(r.kind).toBe("number");
  expect(r.value.canonical.toString()).toBe("10");
});

test("percent of a quantity keeps the quantity's kind and unit", () => {
  const r = engine.evaluate("10% of 2 km");
  expect(r.kind).toBe("length");
  expect(r.formatted).toBe("0.2 kilometres");
});

test("adding a percentage is relative to the left operand", () => {
  expect(engine.evaluate("50 + 20%").value.canonical.toString()).toBe("60");
  expect(engine.evaluate("1 kg + 20%").value.canonical.toString()).toBe("1200");
});

test("subtracting a percentage is relative too", () => {
  expect(engine.evaluate("50 - 20%").value.canonical.toString()).toBe("40");
});

// A percentage is a quantity like any other, so scaling it by a bare number
// is meaningful. `generateRatioOps` used to exclude percent from the
// number-scaling trio along with number, so these three threw
// DimensionMismatchError while the facade's `Percent.scale(3)` answered 60% —
// two public surfaces disagreeing about the same operation.
test("a percentage scales by a bare number in both orders", () => {
  expect(engine.evaluate("20% * 3").formatted).toBe("60%");
  expect(engine.evaluate("3 * 20%").formatted).toBe("60%");
  expect(engine.evaluate("20% * 3").kind).toBe("percent");
});

test("a percentage divides by a bare number", () => {
  expect(engine.evaluate("20% / 2").formatted).toBe("10%");
});

test("of binds tighter than plus", () => {
  expect(engine.evaluate("50 + 20% of 100").value.canonical.toString()).toBe("70");
});

// `off` — the discount reading. It is not an alias for `-|K|percent`: that
// signature takes the base on the left and the percentage on the right, and
// "20% off 50" says them the other way round. Same operand order as `of`,
// complementary arithmetic.
test("a percentage off a number is the number reduced", () => {
  expect(engine.evaluate("20% off 50").value.canonical.toString()).toBe("40");
  expect(engine.evaluate("15% off 200").value.canonical.toString()).toBe("170");
  expect(engine.evaluate("20% off 50").kind).toBe("number");
});

test("a percentage off a quantity keeps the quantity's kind and unit", () => {
  const r = engine.evaluate("20% off 50 kg");
  expect(r.kind).toBe("mass");
  expect(r.formatted).toBe("40 kilograms");
});

test("off binds tighter than plus", () => {
  expect(engine.evaluate("10 + 20% off 50").value.canonical.toString()).toBe("50");
});

// The affine branch of generateRatioOps closes every non-same-kind key
// `ordinaryOps` produces, so temperature refuses `off` without temperature
// knowing the operator exists. Asserted end to end because the refusal is
// load-bearing rather than incidental: tempdelta shares temperature's
// aliases and generates `off|percent|tempdelta` as an ordinary ratio kind, so
// without the closure "20% off 20 C" would quietly answer 16 degrees of
// difference.
test("a percentage off an absolute temperature is refused", () => {
  expect(() => engine.evaluate("20% off 20 C")).toThrow(DimensionMismatchError);
});

// `in` between number and percent. Canonical storage is the same 0-1 ratio on
// both sides, so the conversion only changes which kind is holding it — the
// number is untouched and 0.1 stays 0.1 whichever way it is read.
test("a bare number reads as a percentage", () => {
  const r = engine.evaluate("0.1 in %");
  expect(r.kind).toBe("percent");
  expect(r.value.canonical.toString()).toBe("0.1");
  expect(r.formatted).toBe("10%");
});

// The reading this signature exists for. Without `in|number|percent` the
// engine had no route from a ratio to the percentage it names, so the one
// arithmetic everybody does with percentages could not be written down.
test("a ratio reads as the percentage it names", () => {
  expect(engine.evaluate("5 / 50 in %").formatted).toBe("10%");
});

// "as" is an `in` keyword in the en locale, so this is the same parse and not
// a second code path — asserted so that a locale edit that drops the synonym
// shows up here rather than in a user's expression.
test("as is the same conversion as in", () => {
  expect(engine.evaluate("5 / 50 as %").formatted).toBe("10%");
});

// The number kind has no spellable unit — its lexicon holds the mandatory
// self-alias "one", which `foldNumerals` eats as the numeral 1 before the
// resolver ever sees it, and "number" is not an alias at all. So the
// percent -> number direction is unreachable from the surface today and is
// exercised against the signature, the way `distance` tests its op.
const inOp = (left: string, right: string) => {
  const sig = percent.ops?.find(
    (o) => o.op === "in" && o.left === left && o.right === right,
  );
  if (sig === undefined) throw new Error(`no in|${left}|${right} signature`);
  return (l: Value, r: Value) => sig.apply(l, r, { self: l, locale: "en" } as EvalCtx);
};

const value = (kind: string, unit: string, canonical: string): Value =>
  Object.freeze({ kind, unit, canonical: new Decimal(canonical) });

test("a percentage reads as a bare number", () => {
  const r = inOp("percent", "number")(
    value("percent", "%", "0.2"),
    value("number", "one", "0"),
  );
  expect(r.kind).toBe("number");
  expect(r.unit).toBe("one");
  expect(r.canonical.toString()).toBe("0.2");
});

// The right operand is the conversion target, so its kind and unit are what
// the result carries; the left contributes the number and nothing else. A
// round trip is therefore exactly the identity, and would not be if either
// direction had taken `deriveValue`'s source from the wrong side.
test("number to percent and back is the identity", () => {
  const asPercent = inOp("number", "percent")(
    value("number", "one", "0.1"),
    value("percent", "%", "0"),
  );
  expect(asPercent.kind).toBe("percent");
  expect(asPercent.unit).toBe("%");
  const back = inOp("percent", "number")(asPercent, value("number", "one", "0"));
  expect(back.kind).toBe("number");
  expect(back.canonical.toString()).toBe("0.1");
});
