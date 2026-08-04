import { expect, test } from "bun:test";
import { createEngine } from "../engine";
import en from "../locale/en";
import { datasize } from "./datasize";
import { BUILTIN_KINDS } from "./index";

const engine = createEngine({ locales: [en], kinds: [...BUILTIN_KINDS, datasize] });

test("decimal and binary prefixes are distinct", () => {
  expect(engine.evaluate("1 kb in b").value.canonical.toString()).toBe("1000");
  expect(engine.evaluate("1 kib in b").value.canonical.toString()).toBe("1024");
});

test("mixed-prefix arithmetic converts through the canonical byte", () => {
  const r = engine.evaluate("2 mib + 500 kb in kb");
  expect(r.formatted).toBe("2,597.152kb");
});

test("gigabyte and gibibyte differ as expected", () => {
  // Canonical is bytes whatever the target unit; the formatted value is what
  // actually distinguishes gb from gib.
  expect(engine.evaluate("1 gib in gb").formatted).toBe("1.073741824gb");
  expect(engine.evaluate("1 gb in gib").formatted).toBe("0.931322574615478515625gib");
});
