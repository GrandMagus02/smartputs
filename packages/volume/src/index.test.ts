import { expect, test } from "bun:test";
import { composeLocale, createEngine } from "@smartput/core";
import { english as en } from "@smartput/core/locale/en";
import { BUILTIN_KINDS } from "@smartput/kinds";
import BUILTIN_EN from "@smartput/kinds/locale/en";

const engine = createEngine({
  locales: [composeLocale(en, BUILTIN_EN)],
  kinds: BUILTIN_KINDS,
});

test("area times length is a volume", () => {
  const r = engine.evaluate("3 m * 4 m * 2 m");
  expect(r.kind).toBe("volume");
  // volume.value.canonical is "l" — a Value's `canonical` field for this kind
  // is a magnitude in litres. area's canonical is m², length's is m, so
  // `area.canonical * length.canonical` is a magnitude in m³. 1 m³ = 1000 l,
  // so converting that product into the litre-denominated canonical requires
  // *multiplying* by 1000: 3m * 4m * 2m = 24 m³ = 24000 l.
  expect(r.value.canonical.toString()).toBe("24000");
  // The result is authored back out in m³ (the `unit` the op signature
  // attaches), so a reader sees the natural "24m³" rather than 24000 litres.
  expect(r.formatted).toBe("24m³");
});
