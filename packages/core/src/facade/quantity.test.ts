import { expect, test } from "bun:test";
import { BUILTIN_KINDS, measure } from "@smartput/kinds";
import { UnitParseError } from "../errors";
import { buildRegistry } from "../kind/registry";
import { composeLocale } from "../locale/compose";
import english from "../locale/en";
import { createFacade, type Quantity, type QuantityClass } from "./quantity";

const en = composeLocale(english);

const registry = buildRegistry(BUILTIN_KINDS, [], "en");
const massKind = registry.kinds.get("mass");
if (massKind === undefined) throw new Error("mass kind missing");

// `add`/`sub`/`scale`/`negate` are optional on `Quantity` because an affine
// facade doesn't have them; `mass` is a ratio kind, so it always does. Narrow
// once here instead of asserting non-null at every call site below.
type RatioClass = {
  new (
    ...args: ConstructorParameters<QuantityClass>
  ): Quantity & Required<Pick<Quantity, "add" | "sub" | "scale" | "negate">>;
} & Pick<QuantityClass, "from" | "parse" | "kindId">;

const Weight = createFacade({
  kind: massKind,
  registry,
  locale: en,
}) as unknown as RatioClass;

// `measure` is outside BUILTIN_KINDS (mm/cm collide with length), so the
// round-trip set below builds its own registry over every kind.
const allKinds = [...BUILTIN_KINDS, measure];
const fullRegistry = buildRegistry(allKinds, [], "en");
const facades: Record<string, QuantityClass> = {};
const deltaFacades = new Map<string, QuantityClass>();
for (const [id, k] of fullRegistry.kinds) {
  // `createFacades` has always skipped opaque kinds — a facade is generated
  // from a ratio table, and `.to()`/`.scale()` have nothing to read without
  // one. This loop calls `createFacade` directly, so it has to apply the same
  // rule itself; it never had to before `boolean` made BUILTIN_KINDS contain
  // an opaque kind for the first time.
  if (k.spec.mode !== "ratio") continue;
  const f = createFacade({ kind: k, registry: fullRegistry, locale: en, deltaFacades });
  facades[id] = f;
  deltaFacades.set(id, f);
}
const Measure = facades.measure;
if (Measure === undefined) throw new Error("measure facade missing");

test("constructs in an authored unit and stores it verbatim", () => {
  const w = new Weight(1.5, "kg");
  expect(w.value.toString()).toBe("1.5");
  expect(w.unit).toBe("kg");
});

test("converts to another unit", () => {
  expect(new Weight(1, "kg").to("g").toString()).toBe("1000");
});

test("as rebases on a unit without changing the quantity", () => {
  const rebased = new Weight(1, "kg").as("g");
  expect(rebased.unit).toBe("g");
  expect(rebased.value.toString()).toBe("1000");
});

test("parse accepts a number-unit string", () => {
  expect(Weight.parse("12.5lb").to("g").toString()).toBe("5669.904625");
});

test("parse rejects a bare number", () => {
  expect(() => Weight.parse("12.5")).toThrow(UnitParseError);
});

test("from passes an instance through unchanged", () => {
  const w = new Weight(1, "kg");
  expect(Weight.from(w)).toBe(w);
});

test("from treats a bare number as the canonical unit", () => {
  expect(Weight.from(500).unit).toBe("g");
});

test("equals compares canonical values across units", () => {
  expect(new Weight(1, "kg").equals(new Weight(1000, "g"))).toBe(true);
  expect(new Weight(1, "kg").equals(new Weight(999, "g"))).toBe(false);
  expect(new Weight(1, "kg").equals(new Weight(999, "g"), 2)).toBe(true);
});

test("toString renders in the authored unit", () => {
  expect(new Weight(1.5, "kg").toString()).toBe("1.5 kilograms");
  expect(new Weight(210, "g").toString()).toBe("210 grams");
});

test("toJSON round-trips through from", () => {
  const w = new Weight(1.5, "kg");
  expect(w.toJSON()).toEqual({ value: "1.5", unit: "kg" });
  // The test was named this before it called `from` at all, and `toJSON`'s
  // shape was not a QuantityInput so it could not have typechecked.
  const back = Weight.from(w.toJSON());
  expect(back.value.toString()).toBe("1.5");
  expect(back.unit).toBe("kg");
  expect(back.equals(w)).toBe(true);
});

test("toJSON survives JSON.stringify and carries meta back", () => {
  const m = new Measure(1, "inch", { dpi: 300 });
  const snapshot = JSON.parse(JSON.stringify(m)) as ReturnType<Quantity["toJSON"]>;
  const back = Measure.from(snapshot);
  // meta is part of the quantity's identity: a measure at 300dpi converts to
  // px differently from one at the default 96, so dropping it here silently
  // changed the value.
  expect(back.meta).toEqual({ dpi: 300 });
  expect(back.to("px").toString()).toBe("300");
});

test("parse rejects a malformed number as a SmartputError", () => {
  // Raw `new Decimal("1.2.3")` throws `Error: [DecimalError] Invalid
  // argument`, which is not a SmartputError, so a consumer's catch missed it.
  expect(() => Weight.parse("1.2.3g")).toThrow(UnitParseError);
  expect(() => new Weight("abc", "kg")).toThrow(UnitParseError);
});

// The facade's own output was not valid input to its own parser: PARSE matched
// raw unit *keys*, so it never saw the symbol ("m²", "m/s", "°C") or the plural
// display form ("kilograms") that toString actually emits.
test("parse reads back what toString writes", () => {
  const cases: Array<[string, string, number]> = [
    ["mass", "kg", 1.5], // display plural: "1.5 kilograms"
    ["mass", "g", 210],
    ["mass", "lb", 12.5],
    ["length", "km", 5],
    ["length", "m", 1250], // grouped: "1,250m"
    ["length", "in", 3],
    ["area", "m2", 1], // symbol "m²"
    ["area", "hectare", 2],
    ["speed", "mps", 10], // symbol "m/s"
    ["speed", "mph", 60],
    ["volume", "l", 2],
    ["volume", "m3", 1], // symbol "m³"
    ["percent", "%", 20],
    ["temperature", "c", 20], // symbol "°C"
    ["tempdelta", "k", 5],
    ["datasize", "mib", 2],
    ["duration", "h", 3],
    ["angle", "rad", 2],
  ];

  for (const [kindId, unit, value] of cases) {
    const Class = facades[kindId];
    if (Class === undefined) throw new Error(`no facade for ${kindId}`);
    const original = new Class(value, unit);
    const text = original.toString();
    const parsed = Class.parse(text);
    expect(parsed.unit, `${kindId} ${unit}: ${text}`).toBe(unit);
    expect(parsed.value.toString(), `${kindId} ${unit}: ${text}`).toBe(
      original.value.toString(),
    );
  }
});

test("parse accepts a locale-analyzed plural the engine would accept", () => {
  const Length = facades.length;
  if (Length === undefined) throw new Error("no length facade");
  // "kilometres" is not an alias; the locale's suffix stripper is what turns
  // it into "kilometre". parse used its own vocabulary and never ran it.
  expect(Length.parse("5 kilometres").unit).toBe("km");
  expect(Length.parse("5 kilometres").value.toString()).toBe("5");
});

test("parse still accepts the bare unit key the old regex matched", () => {
  expect(Weight.parse("12.5lb").unit).toBe("lb");
  const Area = facades.area;
  if (Area === undefined) throw new Error("no area facade");
  expect(Area.parse("1m2").unit).toBe("m2");
});

test("instances are frozen", () => {
  expect(Object.isFrozen(new Weight(1, "kg"))).toBe(true);
});

test("an unknown unit throws", () => {
  expect(() => new Weight(1, "furlong")).toThrow(UnitParseError);
});

test("add keeps the left operand's unit", () => {
  expect(new Weight(1, "kg").add(new Weight(500, "g")).toString()).toBe("1.5 kilograms");
});

test("add accepts a parseable string", () => {
  expect(new Weight(1, "kg").add("500g").to("g").toString()).toBe("1500");
});

test("sub, scale and negate", () => {
  expect(new Weight(1, "kg").sub("200g").to("g").toString()).toBe("800");
  expect(new Weight(1, "kg").scale(3).to("kg").toString()).toBe("3");
  expect(new Weight(1, "kg").negate().to("g").toString()).toBe("-1000");
});

test("the original is never mutated", () => {
  const w = new Weight(1, "kg");
  w.add("500g");
  expect(w.value.toString()).toBe("1");
});
