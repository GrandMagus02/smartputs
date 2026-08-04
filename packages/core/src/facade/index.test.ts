import { expect, test } from "bun:test";
import { KindConflictError } from "../errors";
import { buildRegistry } from "../kind/registry";
import { BUILTIN_KINDS } from "../kinds/index";
import { measure } from "../kinds/measure";
import { temperature } from "../kinds/temperature";
import en from "../locale/en";
import { createFacades } from "./index";
import { createFacade, type Quantity, type QuantityClass } from "./quantity";

const F = createFacades({
  kinds: [...BUILTIN_KINDS, measure],
  locale: en,
});

// Some of `Quantity`'s arithmetic members are optional — absent on an affine
// facade, present but different between ratio and dpi-aware kinds. `facade`
// narrows a lookup in `F` to the specific members a given test needs, once,
// instead of asserting non-null at every call site below.
type With<K extends keyof Quantity> = {
  new (
    ...args: ConstructorParameters<QuantityClass>
  ): Quantity & Required<Pick<Quantity, K>>;
} & Pick<QuantityClass, "from" | "parse" | "kindId">;

function facade<K extends keyof Quantity>(id: string): With<K> | undefined {
  return F[id] as unknown as With<K> | undefined;
}

test("a facade is generated per kind", () => {
  expect(Object.keys(F)).toContain("mass");
  expect(Object.keys(F)).toContain("temperature");
});

test("an absolute temperature has no scale", () => {
  const T = F.temperature;
  if (T === undefined) throw new Error("missing");
  expect("scale" in new T(20, "c")).toBe(false);
});

test("a temperature adds a delta and keeps its own unit", () => {
  const T = facade<"add">("temperature");
  const D = F.tempdelta;
  if (T === undefined || D === undefined) throw new Error("missing");
  expect(new T(20, "c").add(new D(5, "c")).to("c").toString()).toBe("25");
});

test("a temperature adds a Fahrenheit delta correctly, not as a reading", () => {
  // 5 F as a *difference* is 2.777...C, so 20C + 5F(delta) = 22.777...C.
  // A buggy implementation that reconstructs the operand as a Temperature
  // (reapplying the -32 offset) would compute 5F as a *reading* of -15C,
  // giving a wrong total of 5C instead.
  const T = facade<"add">("temperature");
  const D = F.tempdelta;
  if (T === undefined || D === undefined) throw new Error("missing");
  expect(new T(20, "c").add(new D(5, "f")).to("c").toString()).toBe(
    "22.77777777777777777777777778",
  );
});

test("two temperatures differ into a delta", () => {
  const T = facade<"diff">("temperature");
  if (T === undefined) throw new Error("missing");
  const d = new T(30, "c").diff(new T(20, "c"));
  expect(d.value.toString()).toBe("10");
});

test("a delta scales", () => {
  const D = facade<"scale">("tempdelta");
  if (D === undefined) throw new Error("missing");
  expect(new D(5, "c").scale(2).to("c").toString()).toBe("10");
});

test("withDpi re-reads pixels and leaves physical units alone", () => {
  const M = facade<"withDpi">("measure");
  if (M === undefined) throw new Error("missing");
  expect(new M(96, "px").withDpi(300).to("inch").toFixed(2)).toBe("0.32");
  expect(new M(1, "inch").withDpi(300).to("inch").toString()).toBe("1");
});

test("dpi defaults to 96 and is readable", () => {
  const M = F.measure;
  if (M === undefined) throw new Error("missing");
  expect(new M(1, "inch").dpi).toBe(96);
  expect(new M(1, "inch", { dpi: 300 }).dpi).toBe(300);
});

test("an affine facade built without its delta kind reports a wiring error, not a parse error", () => {
  // `temperature` alone, deliberately built without `tempdelta`: no
  // `deltaFacades` map is supplied, so it defaults to empty and `.add`/`.diff`
  // can never find a delta class. This is a misconfiguration, not something
  // `UnitParseError` (whose message is always "Cannot parse ... as a
  // quantity") describes.
  const registry = buildRegistry([temperature], [], "en");
  const temperatureKind = registry.kinds.get("temperature");
  if (temperatureKind === undefined) throw new Error("missing");
  const Standalone = createFacade({
    kind: temperatureKind,
    registry,
    locale: en,
  }) as unknown as With<"add">;
  expect(() => new Standalone(20, "c").add(5)).toThrow(KindConflictError);
  try {
    new Standalone(20, "c").add(5);
  } catch (err) {
    expect((err as Error).message).not.toContain("Cannot parse");
    expect((err as Error).message).toContain("tempdelta");
  }
});
