import { expect, test } from "bun:test";
import { createEngine } from "@smartput/core";
import en from "@smartput/core/locale/en";
import { number, percent } from "@smartput/kinds";
import { power } from "./index";

// Registered by name rather than through BUILTIN_KINDS: this package's tests
// have to be green before the kinds barrel learns `power` exists, and the only
// other kinds a plain ratio kind reaches for are the two that its generated
// ops name — `number` for scaling and `percent` for relative adjustment
// (`core/kind/ratio-ops.ts`).
const engine = createEngine({ locales: [en], kinds: [number, percent, power] });

test("the SI prefixes convert through the canonical watt", () => {
  expect(engine.evaluate("1 kw in w").value.canonical.toString()).toBe("1000");
  expect(engine.evaluate("1 gw in mw").formatted).toBe("1,000 megawatts");
});

test("horsepower is mechanical, not metric", () => {
  // Metric horsepower (75 kgf·m/s) is 735.49875 W. Getting that number here
  // would mean the table quietly adopted the other definition.
  expect(engine.evaluate("1 hp in w").value.canonical.toString()).toBe(
    "745.69987158227022",
  );
});

test("horsepower spells the same in both plural rules", () => {
  expect(engine.evaluate("1 hp").formatted).toBe("1 horsepower");
  expect(engine.evaluate("2 hp").formatted).toBe("2 horsepower");
});

test("power has no ops of its own beyond what a ratio kind generates", () => {
  // The power/duration/energy bridge belongs to `@smartput/energy`, the
  // derived kind. Two kinds claiming one signature is a KindConflictError, so
  // this staying empty is what keeps that package registrable alongside this
  // one.
  expect(power.ops ?? []).toEqual([]);
});

test("scaling and percent come for free", () => {
  expect(engine.evaluate("2 kw * 3").kind).toBe("power");
  expect(engine.evaluate("2 kw * 3 in w").value.canonical.toString()).toBe("6000");
  expect(engine.evaluate("100 w + 10%").value.canonical.toString()).toBe("110");
});

test("mixed-prefix arithmetic converts through the canonical watt", () => {
  expect(engine.evaluate("1 mw + 500 kw in mw").formatted).toBe("1.5 megawatts");
});
